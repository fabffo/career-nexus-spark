import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { candidatService } from '@/services';
import { Progress } from '@/components/ui/progress';

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface CsvRow {
  Prénom?: string;
  Nom?: string;
  Email?: string;
  Téléphone?: string;
  'Fiche du candidat'?: string;
}

export function ImportCsvDialog({ open, onOpenChange, onImportComplete }: ImportCsvDialogProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [metier, setMetier] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast.error('Veuillez sélectionner un fichier CSV valide');
    }
  };

  const handleImport = async () => {
    if (!csvFile || !metier.trim()) {
      toast.error('Veuillez sélectionner un fichier CSV et spécifier le métier');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      Papa.parse<CsvRow>(csvFile, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: async (results) => {
          const candidatsToCreate = results.data
            .filter(row => row.Prénom && row.Nom && row.Email)
            .map(row => ({
              nom: row.Nom?.trim() || '',
              prenom: row.Prénom?.trim() || '',
              metier: metier.trim(),
              mail: row.Email?.trim() || '',
              telephone: row.Téléphone?.trim() || '',
              adresse: '',
              detail_cv: row['Fiche du candidat']?.trim() || '',
            }));

          if (candidatsToCreate.length === 0) {
            toast.error('Aucun candidat valide trouvé dans le fichier CSV');
            setIsImporting(false);
            return;
          }

          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < candidatsToCreate.length; i++) {
            try {
              await candidatService.create(candidatsToCreate[i]);
              successCount++;
            } catch (error) {
              console.error(`Erreur lors de la création du candidat ${candidatsToCreate[i].prenom} ${candidatsToCreate[i].nom}:`, error);
              errorCount++;
            }
            setImportProgress(((i + 1) / candidatsToCreate.length) * 100);
          }

          setIsImporting(false);
          
          if (successCount > 0) {
            toast.success(`${successCount} candidat(s) importé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`);
            onImportComplete();
            handleClose();
          } else {
            toast.error('Échec de l\'importation des candidats');
          }
        },
        error: (error) => {
          console.error('Erreur lors du parsing du CSV:', error);
          toast.error('Erreur lors de la lecture du fichier CSV');
          setIsImporting(false);
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
      toast.error('Erreur lors de l\'importation des candidats');
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setCsvFile(null);
    setMetier('');
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importer des candidats depuis un CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="metier">Métier *</Label>
            <Input
              id="metier"
              placeholder="Ex: Développeur, Comptable..."
              value={metier}
              onChange={(e) => setMetier(e.target.value)}
              disabled={isImporting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Fichier CSV *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={isImporting}
                className="flex-1"
              />
              {csvFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setCsvFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={isImporting}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {csvFile && (
              <p className="text-sm text-muted-foreground">
                Fichier sélectionné: {csvFile.name}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Format attendu (séparé par point-virgule) :</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Prénom (obligatoire)</li>
              <li>Nom (obligatoire)</li>
              <li>Email (obligatoire)</li>
              <li>Téléphone (optionnel)</li>
              <li>Fiche du candidat (optionnel)</li>
            </ul>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Importation en cours... {Math.round(importProgress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={!csvFile || !metier.trim() || isImporting}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? 'Importation...' : 'Importer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
