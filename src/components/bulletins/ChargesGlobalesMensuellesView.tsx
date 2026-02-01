import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulletinSalaire } from '@/types/bulletinSalaire';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MOIS_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

interface ChargesGlobalesMensuellesViewProps {
  bulletins: BulletinSalaire[];
}

interface MonthlySummary {
  periode: string;
  mois: number;
  annee: number;
  salaireBrut: number;
  totalUrssaf: number;
  totalRetraite: number;
  totalMutuelle: number;
  totalImpots: number;
  totalAutres: number;
  netAPayer: number;
  coutEmployeur: number;
  nbBulletins: number;
}

export function ChargesGlobalesMensuellesView({ bulletins }: ChargesGlobalesMensuellesViewProps) {
  const years = useMemo(() => {
    const uniqueYears = [...new Set(bulletins.map(b => b.periode_annee))].sort((a, b) => b - a);
    return uniqueYears;
  }, [bulletins]);

  const [selectedYear, setSelectedYear] = useState<string>(years[0]?.toString() || new Date().getFullYear().toString());

  const monthlySummaries = useMemo(() => {
    const summaries: Record<string, MonthlySummary> = {};

    // Filtrer par année sélectionnée
    const filteredBulletins = bulletins.filter(b => b.periode_annee.toString() === selectedYear);

    filteredBulletins.forEach(bulletin => {
      const key = `${bulletin.periode_annee}-${bulletin.periode_mois.toString().padStart(2, '0')}`;
      
      if (!summaries[key]) {
        summaries[key] = {
          periode: `${MOIS_LABELS[bulletin.periode_mois - 1]} ${bulletin.periode_annee}`,
          mois: bulletin.periode_mois,
          annee: bulletin.periode_annee,
          salaireBrut: 0,
          totalUrssaf: 0,
          totalRetraite: 0,
          totalMutuelle: 0,
          totalImpots: 0,
          totalAutres: 0,
          netAPayer: 0,
          coutEmployeur: 0,
          nbBulletins: 0
        };
      }

      const s = summaries[key];
      
      // Recalculer depuis les lignes si disponibles
      const lignes = (bulletin.donnees_brutes as any)?.lignes || [];
      
      let urssaf = 0, retraite = 0, mutuelle = 0, impots = 0, autres = 0;
      
      if (lignes.length > 0) {
        lignes.forEach((ligne: any) => {
          const montant = ligne.montant || 0;
          switch (ligne.organisme_type) {
            case 'urssaf': urssaf += montant; break;
            case 'retraite': retraite += montant; break;
            case 'mutuelle': mutuelle += montant; break;
            case 'impots': impots += Math.abs(montant); break;
            case 'autre': autres += montant; break;
          }
        });
      } else {
        // Fallback sur les valeurs stockées
        urssaf = bulletin.total_urssaf || 0;
        retraite = bulletin.total_retraite || 0;
        mutuelle = (bulletin.donnees_brutes as any)?.total_mutuelle || 0;
        impots = bulletin.total_impots || bulletin.impot_source || 0;
        autres = bulletin.total_autres || 0;
      }

      s.salaireBrut += bulletin.salaire_brut || 0;
      s.totalUrssaf += urssaf;
      s.totalRetraite += retraite;
      s.totalMutuelle += mutuelle;
      s.totalImpots += impots;
      s.totalAutres += autres;
      s.netAPayer += bulletin.net_a_payer || 0;
      s.coutEmployeur += (bulletin.donnees_brutes as any)?.cout_employeur || bulletin.cout_employeur || 0;
      s.nbBulletins += 1;
    });

    return Object.values(summaries).sort((a, b) => a.mois - b.mois);
  }, [bulletins, selectedYear]);

  const totals = useMemo(() => {
    return monthlySummaries.reduce((acc, s) => ({
      salaireBrut: acc.salaireBrut + s.salaireBrut,
      totalUrssaf: acc.totalUrssaf + s.totalUrssaf,
      totalRetraite: acc.totalRetraite + s.totalRetraite,
      totalMutuelle: acc.totalMutuelle + s.totalMutuelle,
      totalImpots: acc.totalImpots + s.totalImpots,
      totalAutres: acc.totalAutres + s.totalAutres,
      netAPayer: acc.netAPayer + s.netAPayer,
      coutEmployeur: acc.coutEmployeur + s.coutEmployeur,
      nbBulletins: acc.nbBulletins + s.nbBulletins
    }), {
      salaireBrut: 0, totalUrssaf: 0, totalRetraite: 0, totalMutuelle: 0,
      totalImpots: 0, totalAutres: 0, netAPayer: 0, coutEmployeur: 0, nbBulletins: 0
    });
  }, [monthlySummaries]);

  const chartData = monthlySummaries.map(s => ({
    name: MOIS_LABELS[s.mois - 1],
    URSSAF: Math.abs(s.totalUrssaf),
    Retraite: Math.abs(s.totalRetraite),
    Mutuelle: Math.abs(s.totalMutuelle),
    Impôts: Math.abs(s.totalImpots),
    Autres: Math.abs(s.totalAutres)
  }));

  const formatMontant = (val: number) => `${val.toFixed(2)} €`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Charges Globales par Mois</h2>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Graphique */}
      <Card className="p-4">
        <h3 className="text-lg font-medium mb-4">Répartition des charges par mois</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatMontant(value)} />
            <Legend />
            <Bar dataKey="URSSAF" stackId="a" fill="#3b82f6" />
            <Bar dataKey="Retraite" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Mutuelle" stackId="a" fill="#10b981" />
            <Bar dataKey="Impôts" stackId="a" fill="#8b5cf6" />
            <Bar dataKey="Autres" stackId="a" fill="#6b7280" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Tableau détaillé */}
      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">Bulletins</TableHead>
              <TableHead className="text-right">Brut</TableHead>
              <TableHead className="text-right text-blue-600">URSSAF</TableHead>
              <TableHead className="text-right text-amber-600">Retraite</TableHead>
              <TableHead className="text-right text-emerald-600">Mutuelle</TableHead>
              <TableHead className="text-right text-purple-600">Impôts</TableHead>
              <TableHead className="text-right text-gray-600">Autres</TableHead>
              <TableHead className="text-right text-green-600">Net Payé</TableHead>
              <TableHead className="text-right text-orange-600">Coût Employeur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlySummaries.map(s => (
              <TableRow key={`${s.annee}-${s.mois}`}>
                <TableCell className="font-medium">{s.periode}</TableCell>
                <TableCell className="text-right">{s.nbBulletins}</TableCell>
                <TableCell className="text-right">{formatMontant(s.salaireBrut)}</TableCell>
                <TableCell className="text-right text-blue-600">{formatMontant(Math.abs(s.totalUrssaf))}</TableCell>
                <TableCell className="text-right text-amber-600">{formatMontant(Math.abs(s.totalRetraite))}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatMontant(Math.abs(s.totalMutuelle))}</TableCell>
                <TableCell className="text-right text-purple-600">{formatMontant(s.totalImpots)}</TableCell>
                <TableCell className="text-right text-gray-600">{formatMontant(Math.abs(s.totalAutres))}</TableCell>
                <TableCell className="text-right text-green-600 font-medium">{formatMontant(s.netAPayer)}</TableCell>
                <TableCell className="text-right text-orange-600 font-medium">{formatMontant(s.coutEmployeur)}</TableCell>
              </TableRow>
            ))}
            {/* Ligne total */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>TOTAL {selectedYear}</TableCell>
              <TableCell className="text-right">{totals.nbBulletins}</TableCell>
              <TableCell className="text-right">{formatMontant(totals.salaireBrut)}</TableCell>
              <TableCell className="text-right text-blue-600">{formatMontant(Math.abs(totals.totalUrssaf))}</TableCell>
              <TableCell className="text-right text-amber-600">{formatMontant(Math.abs(totals.totalRetraite))}</TableCell>
              <TableCell className="text-right text-emerald-600">{formatMontant(Math.abs(totals.totalMutuelle))}</TableCell>
              <TableCell className="text-right text-purple-600">{formatMontant(totals.totalImpots)}</TableCell>
              <TableCell className="text-right text-gray-600">{formatMontant(Math.abs(totals.totalAutres))}</TableCell>
              <TableCell className="text-right text-green-600">{formatMontant(totals.netAPayer)}</TableCell>
              <TableCell className="text-right text-orange-600">{formatMontant(totals.coutEmployeur)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
