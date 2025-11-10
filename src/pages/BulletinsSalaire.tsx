import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Edit, Trash2, Eye, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { bulletinSalaireService } from '@/services/bulletinSalaireService';
import { salarieService } from '@/services/salarieService';
import { BulletinUploadZone } from '@/components/BulletinUploadZone';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { BulletinSalaire } from '@/types/bulletinSalaire';
import * as XLSX from 'xlsx';

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const STATUT_LABELS = {
  EN_ATTENTE: 'En attente',
  ANALYSE_EN_COURS: 'Analyse en cours',
  VALIDE: 'Validé',
  ERREUR: 'Erreur'
};

const STATUT_COLORS = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ANALYSE_EN_COURS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  VALIDE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ERREUR: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

export default function BulletinsSalaire() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showUpload, setShowUpload] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterSalarie, setFilterSalarie] = useState<string>('');
  const [filterPeriode, setFilterPeriode] = useState<string>('');

  const { data: bulletins = [], isLoading } = useQuery({
    queryKey: ['bulletins-salaire'],
    queryFn: () => bulletinSalaireService.getAll()
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries'],
    queryFn: () => salarieService.getAll()
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bulletinSalaireService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletins-salaire'] });
      toast({ title: 'Bulletin supprimé avec succès' });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le bulletin',
        variant: 'destructive'
      });
    }
  });

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    
    for (const file of files) {
      try {
        // 1. Upload du fichier
        const fileUrl = await bulletinSalaireService.uploadFile(file);
        
        // 2. Convertir en base64 pour l'analyse
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              
              // 3. Analyser avec l'IA
              const result = await bulletinSalaireService.analyserBulletin(base64);
              
              if (result.success) {
                const data = result.data;
                
                // 4. Trouver le salarié par nom
                let salarieId = undefined;
                if (data.nom_salarie) {
                  const salarie = salaries.find(s => 
                    `${s.prenom} ${s.nom}`.toLowerCase().includes(data.nom_salarie.toLowerCase()) ||
                    `${s.nom} ${s.prenom}`.toLowerCase().includes(data.nom_salarie.toLowerCase())
                  );
                  salarieId = salarie?.id;
                }
                
                // 5. Créer l'enregistrement
                await bulletinSalaireService.create({
                  salarie_id: salarieId,
                  fichier_url: fileUrl,
                  nom_fichier: file.name,
                  periode_mois: data.periode_mois,
                  periode_annee: data.periode_annee,
                  salaire_brut: data.salaire_brut,
                  charges_sociales_salariales: data.charges_sociales_salariales,
                  charges_sociales_patronales: data.charges_sociales_patronales,
                  impot_source: data.impot_source,
                  net_a_payer: data.net_a_payer,
                  statut: 'VALIDE',
                  donnees_brutes: data
                });
                
                toast({
                  title: 'Bulletin analysé',
                  description: `${file.name} a été traité avec succès`
                });
                
                resolve(true);
              } else {
                throw new Error('Échec de l\'analyse');
              }
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
        });
        
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: 'Erreur',
          description: `Impossible de traiter ${file.name}`,
          variant: 'destructive'
        });
      }
    }
    
    setIsProcessing(false);
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ['bulletins-salaire'] });
  };

  const exportToExcel = () => {
    const data = filteredBulletins.map(b => ({
      'Salarié': b.salarie ? `${b.salarie.prenom} ${b.salarie.nom}` : 'Non attribué',
      'Période': `${MOIS_LABELS[b.periode_mois - 1]} ${b.periode_annee}`,
      'Salaire Brut': b.salaire_brut || '',
      'Charges Salariales': b.charges_sociales_salariales || '',
      'Charges Patronales': b.charges_sociales_patronales || '',
      'Impôt Source': b.impot_source || '',
      'Net à Payer': b.net_a_payer || '',
      'Statut': STATUT_LABELS[b.statut]
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulletins');
    XLSX.writeFile(wb, `bulletins_salaire_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const columns: ColumnDef<BulletinSalaire>[] = [
    {
      accessorKey: 'salarie',
      header: 'Salarié',
      cell: ({ row }) => {
        const salarie = row.original.salarie;
        return salarie ? `${salarie.prenom} ${salarie.nom}` : (
          <span className="text-muted-foreground">Non attribué</span>
        );
      }
    },
    {
      accessorKey: 'periode',
      header: 'Période',
      cell: ({ row }) => 
        `${MOIS_LABELS[row.original.periode_mois - 1]} ${row.original.periode_annee}`
    },
    {
      accessorKey: 'salaire_brut',
      header: 'Salaire Brut',
      cell: ({ row }) => row.original.salaire_brut 
        ? `${row.original.salaire_brut.toFixed(2)} €`
        : '-'
    },
    {
      accessorKey: 'net_a_payer',
      header: 'Net à Payer',
      cell: ({ row }) => row.original.net_a_payer
        ? `${row.original.net_a_payer.toFixed(2)} €`
        : '-'
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge className={STATUT_COLORS[row.original.statut]}>
          {STATUT_LABELS[row.original.statut]}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(row.original.fichier_url, '_blank')}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(row.original.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  const filteredBulletins = bulletins.filter(b => {
    if (filterSalarie && b.salarie_id !== filterSalarie) return false;
    if (filterPeriode) {
      const [mois, annee] = filterPeriode.split('-').map(Number);
      if (b.periode_mois !== mois || b.periode_annee !== annee) return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulletins de Salaire</h1>
          <p className="text-muted-foreground">
            Gérez et analysez les bulletins de salaire automatiquement
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportToExcel}
            disabled={filteredBulletins.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exporter Excel
          </Button>
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="w-4 h-4 mr-2" />
            {showUpload ? 'Annuler' : 'Importer des bulletins'}
          </Button>
        </div>
      </div>

      {showUpload && (
        <Card className="p-6">
          <BulletinUploadZone
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
          />
        </Card>
      )}

      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <Select value={filterSalarie} onValueChange={setFilterSalarie}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrer par salarié" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les salariés</SelectItem>
              {salaries.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prenom} {s.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="month"
            value={filterPeriode}
            onChange={(e) => setFilterPeriode(e.target.value)}
            className="w-[200px]"
            placeholder="Filtrer par période"
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredBulletins}
          searchPlaceholder="Rechercher un bulletin..."
        />
      </Card>
    </div>
  );
}
