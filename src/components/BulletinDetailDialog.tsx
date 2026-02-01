import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BulletinSalaire, BulletinLigneExtrait } from '@/types/bulletinSalaire';

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface BulletinDetailDialogProps {
  bulletin: BulletinSalaire | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulletinDetailDialog({ bulletin, open, onOpenChange }: BulletinDetailDialogProps) {
  if (!bulletin) return null;

  const data = bulletin.donnees_brutes as any;
  const lignes = data?.lignes as BulletinLigneExtrait[] || [];

  // Grouper les lignes par organisme_type
  const lignesUrssaf = lignes.filter(l => l.organisme_type === 'urssaf');
  const lignesRetraite = lignes.filter(l => l.organisme_type === 'retraite');
  const lignesImpots = lignes.filter(l => l.organisme_type === 'impots');
  const lignesMutuelle = lignes.filter(l => l.organisme_type === 'mutuelle');
  const lignesAutres = lignes.filter(l => l.organisme_type === 'autre');
  const lignesSalarie = lignes.filter(l => l.organisme_type === 'salarie');

  const formatMontant = (val: number | null | undefined) => 
    val != null ? `${val.toFixed(2)} €` : '-';

  const getConfidenceBadge = (conf: number | undefined) => {
    if (!conf) return null;
    if (conf >= 0.9) return <Badge className="bg-green-100 text-green-800">Confiance: {(conf * 100).toFixed(0)}%</Badge>;
    if (conf >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800">Confiance: {(conf * 100).toFixed(0)}%</Badge>;
    return <Badge className="bg-red-100 text-red-800">Confiance: {(conf * 100).toFixed(0)}%</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détail du bulletin - {MOIS_LABELS[bulletin.periode_mois - 1]} {bulletin.periode_annee}</span>
            {getConfidenceBadge(data?.confidence)}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Résumé principal */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Salaire Brut</div>
                <div className="text-lg font-bold">{formatMontant(data?.salaire_brut)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Net avant impôt</div>
                <div className="text-lg font-bold">{formatMontant(data?.net_avant_impot)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Impôt (PAS)</div>
                <div className="text-lg font-bold text-red-600">{formatMontant(data?.pas)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Net Payé</div>
                <div className="text-lg font-bold text-green-600">{formatMontant(data?.net_paye)}</div>
              </Card>
            </div>

            {/* Répartition par destinataire */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Répartition des flux financiers</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">URSSAF</div>
                  <div className="text-lg font-bold text-blue-600">{formatMontant(data?.total_urssaf)}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Retraite (Humanis)</div>
                  <div className="text-lg font-bold text-amber-600">{formatMontant(data?.total_retraite)}</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Impôts (DGFiP)</div>
                  <div className="text-lg font-bold text-red-600">{formatMontant(data?.total_impots)}</div>
                </div>
                <div className="text-center p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Mutuelle</div>
                  <div className="text-lg font-bold text-pink-600">{formatMontant(data?.total_mutuelle)}</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Autres (ADESATT...)</div>
                  <div className="text-lg font-bold text-purple-600">{formatMontant(data?.total_autres)}</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Salarié</div>
                  <div className="text-lg font-bold text-green-600">{formatMontant(data?.net_paye)}</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Coût Employeur</div>
                  <div className="text-lg font-bold text-orange-600">{formatMontant(data?.cout_employeur)}</div>
                </div>
              </div>
            </Card>

            <Separator />

            {/* Lignes détaillées URSSAF */}
            {lignesUrssaf.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Cotisations URSSAF ({lignesUrssaf.length} lignes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Section</th>
                        <th className="py-2 font-medium">Libellé</th>
                        <th className="py-2 font-medium text-right">Base</th>
                        <th className="py-2 font-medium text-right">Taux</th>
                        <th className="py-2 font-medium text-right">Montant</th>
                        <th className="py-2 font-medium">Nature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesUrssaf.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{l.section}</td>
                          <td className="py-2">{l.libelle}</td>
                          <td className="py-2 text-right">{l.base ? `${l.base.toFixed(2)} €` : '-'}</td>
                          <td className="py-2 text-right">{l.taux ? `${l.taux}%` : '-'}</td>
                          <td className="py-2 text-right font-medium">{l.montant.toFixed(2)} €</td>
                          <td className="py-2">
                            <Badge variant="outline" className={l.nature === 'patronale' ? 'border-orange-500' : 'border-blue-500'}>
                              {l.nature}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Lignes détaillées Retraite */}
            {lignesRetraite.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                  Retraite Complémentaire - Humanis ({lignesRetraite.length} lignes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Section</th>
                        <th className="py-2 font-medium">Libellé</th>
                        <th className="py-2 font-medium text-right">Base</th>
                        <th className="py-2 font-medium text-right">Taux</th>
                        <th className="py-2 font-medium text-right">Montant</th>
                        <th className="py-2 font-medium">Nature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesRetraite.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{l.section}</td>
                          <td className="py-2">{l.libelle}</td>
                          <td className="py-2 text-right">{l.base ? `${l.base.toFixed(2)} €` : '-'}</td>
                          <td className="py-2 text-right">{l.taux ? `${l.taux}%` : '-'}</td>
                          <td className="py-2 text-right font-medium">{l.montant.toFixed(2)} €</td>
                          <td className="py-2">
                            <Badge variant="outline" className={l.nature === 'patronale' ? 'border-orange-500' : 'border-amber-500'}>
                              {l.nature}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Lignes détaillées Impôts */}
            {lignesImpots.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  Impôts (DGFiP) ({lignesImpots.length} lignes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Libellé</th>
                        <th className="py-2 font-medium text-right">Base</th>
                        <th className="py-2 font-medium text-right">Taux</th>
                        <th className="py-2 font-medium text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesImpots.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{l.libelle}</td>
                          <td className="py-2 text-right">{l.base ? `${l.base.toFixed(2)} €` : '-'}</td>
                          <td className="py-2 text-right">{l.taux ? `${l.taux}%` : '-'}</td>
                          <td className="py-2 text-right font-medium text-red-600">{l.montant.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Lignes détaillées Mutuelle */}
            {lignesMutuelle.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-pink-500 rounded-full"></span>
                  Mutuelle / Complémentaire santé ({lignesMutuelle.length} lignes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Section</th>
                        <th className="py-2 font-medium">Libellé</th>
                        <th className="py-2 font-medium text-right">Base</th>
                        <th className="py-2 font-medium text-right">Taux</th>
                        <th className="py-2 font-medium text-right">Montant</th>
                        <th className="py-2 font-medium">Nature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesMutuelle.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{l.section}</td>
                          <td className="py-2">{l.libelle}</td>
                          <td className="py-2 text-right">{l.base ? `${l.base.toFixed(2)} €` : '-'}</td>
                          <td className="py-2 text-right">{l.taux ? `${l.taux}%` : '-'}</td>
                          <td className="py-2 text-right font-medium">{l.montant.toFixed(2)} €</td>
                          <td className="py-2">
                            <Badge variant="outline" className={l.nature === 'patronale' ? 'border-orange-500' : 'border-pink-500'}>
                              {l.nature}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Lignes détaillées Autres */}
            {lignesAutres.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  Autres contributions ({lignesAutres.length} lignes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Organisme</th>
                        <th className="py-2 font-medium">Libellé</th>
                        <th className="py-2 font-medium text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesAutres.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{l.organisme_nom || 'N/A'}</td>
                          <td className="py-2">{l.libelle}</td>
                          <td className="py-2 text-right font-medium">{l.montant.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Cotisations salariales vs patronales */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Récapitulatif des cotisations</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-muted-foreground">Cotisations Salariales</div>
                  <div className="text-xl font-bold">{formatMontant(data?.total_cotisations_salariales)}</div>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-sm text-muted-foreground">Charges Patronales</div>
                  <div className="text-xl font-bold">{formatMontant(data?.total_charges_patronales)}</div>
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
