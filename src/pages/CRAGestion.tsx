import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, Save, Send, Download, Calendar, CheckCircle, 
  XCircle, Clock, User, Building, Briefcase, FileText 
} from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { craService } from "@/services/craService";
import { CRA, CRAJour, TypeJour } from "@/types/cra";

export default function CRAGestion() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Données principales
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [joursFeries, setJoursFeries] = useState<any[]>([]);
  
  // Sélection
  const [selectedPrestataire, setSelectedPrestataire] = useState<string>("");
  const [selectedMission, setSelectedMission] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  // CRA
  const [cra, setCra] = useState<CRA | null>(null);
  const [craJours, setCraJours] = useState<Map<string, CRAJour>>(new Map());
  const [commentaires, setCommentaires] = useState("");

  useEffect(() => {
    loadInitialData();
    
    // Pré-remplir depuis les paramètres URL
    const prestataireParam = searchParams.get('prestataire');
    const missionParam = searchParams.get('mission');
    const craParam = searchParams.get('cra');
    
    if (prestataireParam) setSelectedPrestataire(prestataireParam);
    if (missionParam) setSelectedMission(missionParam);
  }, []);

  useEffect(() => {
    if (selectedPrestataire) {
      loadMissions();
    }
  }, [selectedPrestataire]);

  useEffect(() => {
    if (selectedMission && selectedYear && selectedMonth) {
      loadCRA();
    }
  }, [selectedMission, selectedYear, selectedMonth]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Charger les prestataires de la table prestataires
      const { data: prestatairesData, error: prestataireError } = await supabase
        .from('prestataires')
        .select('*')
        .order('nom');

      if (prestataireError) throw prestataireError;

      // Charger les salariés de type PRESTATAIRE
      const { data: salariesPrestataireData, error: salarieError } = await supabase
        .from('salaries')
        .select('id, nom, prenom, email, telephone')
        .eq('role', 'PRESTATAIRE')
        .order('nom');

      if (salarieError) throw salarieError;

      // Combiner les deux listes
      const allPrestataires = [
        ...(prestatairesData || []),
        ...(salariesPrestataireData || []).map(s => ({
          ...s,
          isSalarie: true
        }))
      ];

      setPrestataires(allPrestataires);

      // Charger les jours fériés
      const jours = await craService.getJoursFeries(selectedYear);
      setJoursFeries(jours);

    } catch (error: any) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const loadMissions = async () => {
    try {
      const selectedPrestatairObj = prestataires.find(p => p.id === selectedPrestataire);
      const isSalarie = selectedPrestatairObj?.isSalarie;

      let allMissions: any[] = [];

      if (isSalarie) {
        // C'est un salarié prestataire, chercher par salarie_id
        const { data: salarieMissions, error: salarieError } = await supabase
          .from('missions')
          .select(`
            *,
            contrat:contrats(
              client:clients(raison_sociale)
            )
          `)
          .eq('salarie_id', selectedPrestataire)
          .eq('statut', 'EN_COURS')
          .not('contrat_id', 'is', null);

        if (salarieError) throw salarieError;
        allMissions = salarieMissions || [];
      } else {
        // C'est un prestataire de la table prestataires
        const { data: directMissions, error: directError } = await supabase
          .from('missions')
          .select(`
            *,
            contrat:contrats(
              client:clients(raison_sociale)
            )
          `)
          .eq('prestataire_id', selectedPrestataire)
          .eq('statut', 'EN_COURS')
          .not('contrat_id', 'is', null);

        if (directError) throw directError;
        allMissions = directMissions || [];

        // Vérifier si le prestataire a un salarie_id
        const { data: prestataireData } = await supabase
          .from('prestataires')
          .select('salarie_id')
          .eq('id', selectedPrestataire)
          .single();

        // Si le prestataire a un salarie_id, chercher aussi par salarie_id
        if (prestataireData?.salarie_id) {
          const { data: salarieMissions, error: salarieError } = await supabase
            .from('missions')
            .select(`
              *,
              contrat:contrats(
                client:clients(raison_sociale)
              )
            `)
            .eq('salarie_id', prestataireData.salarie_id)
            .eq('statut', 'EN_COURS')
            .not('contrat_id', 'is', null);

          if (!salarieError && salarieMissions) {
            allMissions = [...allMissions, ...salarieMissions];
          }
        }
      }

      // Dédupliquer les missions par ID et filtrer celles sans client
      const uniqueMissions = Array.from(
        new Map(allMissions.map(m => [m.id, m])).values()
      ).filter(m => m.contrat?.client?.raison_sociale);

      setMissions(uniqueMissions);
      
      if (uniqueMissions.length > 0 && !selectedMission) {
        setSelectedMission(uniqueMissions[0].id);
      }
    } catch (error: any) {
      console.error("Erreur lors du chargement des missions:", error);
      toast.error("Erreur lors du chargement des missions");
    }
  };

  const loadCRA = async () => {
    try {
      setLoading(true);

      // Charger ou créer le CRA
      const existingCra = await craService.getByMissionPeriod(selectedMission, selectedYear, selectedMonth);
      
      if (existingCra) {
        setCra(existingCra);
        setCommentaires(existingCra.commentaires || "");
        
        // Charger les jours
        const jours = await craService.getJoursByCRA(existingCra.id);
        const joursMap = new Map(jours.map(j => [j.date, j]));
        setCraJours(joursMap);
      } else {
        // Initialiser un nouveau CRA
        setCra(null);
        setCraJours(new Map());
        setCommentaires("");
        
        // Pré-remplir les weekends et jours fériés
        initializeDefaultDays();
      }

    } catch (error: any) {
      console.error("Erreur lors du chargement du CRA:", error);
      toast.error("Erreur lors du chargement du CRA");
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultDays = () => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    
    const newJours = new Map<string, CRAJour>();
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isWeekendDay = isWeekend(day);
      const isFerie = joursFeries.some(f => f.date === dateStr);
      
      if (isWeekendDay || isFerie) {
        newJours.set(dateStr, {
          id: '',
          cra_id: '',
          date: dateStr,
          type_jour: isFerie ? 'FERIE' : 'WEEKEND',
          heures: 0,
          commentaire: isFerie ? joursFeries.find(f => f.date === dateStr)?.libelle : undefined
        });
      }
    });
    
    setCraJours(newJours);
  };

  // Conversion jours <-> heures
  const joursToHeures = (jours: number): number => jours * 8;
  const heuresToJours = (heures: number): number => heures / 8;

  const updateJour = (date: string, updates: Partial<CRAJour>) => {
    const newJours = new Map(craJours);
    const existing = newJours.get(date);
    
    if (existing) {
      newJours.set(date, { ...existing, ...updates });
    } else {
      newJours.set(date, {
        id: '',
        cra_id: cra?.id || '',
        date,
        type_jour: 'TRAVAILLE',
        heures: 8,
        ...updates
      });
    }
    
    setCraJours(newJours);
  };

  const markAllWorkDays = () => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    
    const newJours = new Map(craJours);
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isWeekendDay = isWeekend(day);
      const isFerie = joursFeries.some(f => f.date === dateStr);
      
      if (!isWeekendDay && !isFerie) {
        newJours.set(dateStr, {
          id: craJours.get(dateStr)?.id || '',
          cra_id: cra?.id || '',
          date: dateStr,
          type_jour: 'TRAVAILLE',
          heures: 8
        });
      }
    });
    
    setCraJours(newJours);
    toast.success("Tous les jours ouvrés ont été marqués comme travaillés");
  };

  const saveCRA = async (submit: boolean = false) => {
    if (!selectedMission || !selectedPrestataire) {
      toast.error("Veuillez sélectionner un prestataire et une mission");
      return;
    }

    try {
      setSaving(true);

      let craId = cra?.id;

      // Créer ou mettre à jour le CRA
      if (!cra) {
        const newCra = await craService.create({
          mission_id: selectedMission,
          prestataire_id: selectedPrestataire,
          annee: selectedYear,
          mois: selectedMonth,
          statut: submit ? 'SOUMIS' : 'BROUILLON',
          jours_travailles: 0,
          jours_conges: 0,
          jours_absence: 0,
          total_heures: 0,
          ca_mensuel: 0,
          commentaires,
          ...(submit && { date_soumission: new Date().toISOString() })
        });
        craId = newCra.id;
        setCra(newCra);
      } else {
        await craService.update(cra.id, {
          statut: submit ? 'SOUMIS' : cra.statut,
          commentaires,
          ...(submit && { date_soumission: new Date().toISOString() })
        });
      }

      // Sauvegarder les jours
      if (craId) {
        const joursToSave = Array.from(craJours.values()).map(j => ({
          cra_id: craId!,
          date: j.date,
          type_jour: j.type_jour,
          heures: j.heures,
          commentaire: j.commentaire
        }));

        await craService.upsertJours(joursToSave);
      }

      toast.success(submit ? "CRA soumis pour validation" : "CRA enregistré");
      
      // Recharger le CRA
      await loadCRA();

    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde du CRA");
    } finally {
      setSaving(false);
    }
  };

  const devaliderCRA = async () => {
    if (!cra || cra.statut !== 'VALIDE') {
      toast.error("Ce CRA n'est pas validé");
      return;
    }

    try {
      setSaving(true);
      
      await craService.update(cra.id, {
        statut: 'BROUILLON',
        date_validation: null,
        valide_par: null,
        commentaires_validation: null
      });

      toast.success("CRA dévalidé, vous pouvez maintenant le modifier");
      await loadCRA();

    } catch (error: any) {
      console.error("Erreur lors de la dévalidation:", error);
      toast.error("Erreur lors de la dévalidation du CRA");
    } finally {
      setSaving(false);
    }
  };

  const calculateTotals = () => {
    let travailles = 0;
    let conges = 0;
    let absences = 0;
    let heures = 0;
    let jours = 0;

    craJours.forEach(jour => {
      if (jour.type_jour === 'TRAVAILLE') {
        const joursValue = heuresToJours(jour.heures || 0);
        travailles += joursValue;
        jours += joursValue;
        heures += jour.heures || 0;
      } else if (['CONGE_PAYE', 'RTT'].includes(jour.type_jour)) {
        conges++;
      } else if (['ABSENCE', 'ARRET_MALADIE'].includes(jour.type_jour)) {
        absences++;
      }
    });

    const mission = missions.find(m => m.id === selectedMission);
    // Pour les missions avec TJM, utiliser le TJM
    // Pour les missions sans TJM (frais mission, etc.), utiliser le prix_ht comme équivalent journalier
    const tjm = mission?.tjm || mission?.prix_ht || 0;
    const ca = travailles * tjm;

    return { travailles, conges, absences, heures, jours, ca, tjm };
  };

  const totals = calculateTotals();
  const prestataire = prestataires.find(p => p.id === selectedPrestataire);
  const mission = missions.find(m => m.id === selectedMission);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);
  const months = [
    { value: 1, label: "Janvier" }, { value: 2, label: "Février" }, { value: 3, label: "Mars" },
    { value: 4, label: "Avril" }, { value: 5, label: "Mai" }, { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" }, { value: 8, label: "Août" }, { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" }, { value: 11, label: "Novembre" }, { value: 12, label: "Décembre" }
  ];

  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth - 1, i + 1);
    const dateStr = format(date, 'yyyy-MM-dd');
    return {
      date,
      dateStr,
      dayName: format(date, 'EEEE', { locale: fr }),
      jour: craJours.get(dateStr)
    };
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/prestataires-missions')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gestion des CRA</h1>
            <p className="text-muted-foreground">Saisie et validation des Comptes Rendus d'Activité</p>
          </div>
        </div>
      </div>

      {/* Sélection et informations */}
      <Card>
        <CardHeader>
          <CardTitle>Sélection du CRA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Prestataire *</Label>
              <Select value={selectedPrestataire} onValueChange={setSelectedPrestataire}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {prestataires.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mission</Label>
              <Select value={selectedMission} onValueChange={setSelectedMission} disabled={!selectedPrestataire}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {missions.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Année</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mois</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMission && mission && (
            <div className="grid gap-4 md:grid-cols-3 p-4 bg-accent rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Prestataire</div>
                  <div className="font-medium">{prestataire?.prenom} {prestataire?.nom}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Client</div>
                  <div className="font-medium">{mission.contrat?.client?.raison_sociale || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">TJM</div>
                  <div className="font-medium">{mission.tjm} €</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMission && (
        <>
          {/* Actions rapides */}
          <Card>
            <CardHeader>
              <CardTitle>Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={markAllWorkDays} variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Marquer tous jours ouvrés
              </Button>
              <Button variant="outline" disabled>
                <Calendar className="h-4 w-4 mr-2" />
                Marquer jours fériés
              </Button>
            </CardContent>
          </Card>

          {/* Grille de saisie */}
          <Card>
            <CardHeader>
              <CardTitle>Grille de Saisie - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-24">Date</th>
                      <th className="text-left p-2 w-32">Jour</th>
                      <th className="text-left p-2 w-48">Type</th>
                      <th className="text-right p-2 w-32">Jours</th>
                      <th className="text-left p-2">Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthDays.map(({ date, dateStr, dayName, jour }) => {
                      const isWeekendDay = isWeekend(date);
                      const isFerie = joursFeries.some(f => f.date === dateStr);
                      const disabled = isWeekendDay || isFerie;

                      return (
                        <tr key={dateStr} className={`border-b ${disabled ? 'bg-gray-50' : ''}`}>
                          <td className="p-2">{format(date, 'dd/MM')}</td>
                          <td className="p-2 capitalize">{dayName}</td>
                          <td className="p-2">
                            <Select
                              value={jour?.type_jour || (disabled ? (isFerie ? 'FERIE' : 'WEEKEND') : '')}
                              onValueChange={(value) => updateJour(dateStr, { type_jour: value as TypeJour })}
                              disabled={disabled && !jour}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TRAVAILLE">Travaillé</SelectItem>
                                <SelectItem value="CONGE_PAYE">Congé payé</SelectItem>
                                <SelectItem value="RTT">RTT</SelectItem>
                                <SelectItem value="ABSENCE">Absence</SelectItem>
                                <SelectItem value="ARRET_MALADIE">Arrêt maladie</SelectItem>
                                <SelectItem value="FORMATION">Formation</SelectItem>
                                {isFerie && <SelectItem value="FERIE">Férié</SelectItem>}
                                {isWeekendDay && <SelectItem value="WEEKEND">Weekend</SelectItem>}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Select
                              value={jour?.heures ? jour.heures.toString() : (jour?.type_jour === 'TRAVAILLE' ? '8' : '0')}
                              onValueChange={(value) => updateJour(dateStr, { heures: parseFloat(value) })}
                              disabled={disabled || jour?.type_jour !== 'TRAVAILLE'}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0 j</SelectItem>
                                <SelectItem value="2">0,25 j</SelectItem>
                                <SelectItem value="4">0,5 j</SelectItem>
                                <SelectItem value="6">0,75 j</SelectItem>
                                <SelectItem value="8">1 j</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              value={jour?.commentaire || ''}
                              onChange={(e) => updateJour(dateStr, { commentaire: e.target.value })}
                              placeholder="Commentaire..."
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Résumé et validation */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Commentaires</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={commentaires}
                  onChange={(e) => setCommentaires(e.target.value)}
                  placeholder="Notes ou commentaires sur ce CRA..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours travaillés:</span>
                  <span className="font-bold">{totals.travailles.toFixed(2)} j</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours de congés:</span>
                  <span className="font-bold">{totals.conges} j</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours d'absence:</span>
                  <span className="font-bold">{totals.absences} j</span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold">CA du mois:</span>
                  <span className="font-bold text-green-600">{totals.ca.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="pt-3 space-y-2">
                  {cra?.statut && (
                    <div className="flex items-center justify-center">
                      {cra.statut === 'VALIDE' ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Validé
                        </Badge>
                      ) : cra.statut === 'SOUMIS' ? (
                        <Badge className="bg-orange-500">
                          <Clock className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                      ) : cra.statut === 'REJETE' ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejeté
                        </Badge>
                      ) : (
                        <Badge variant="outline">Brouillon</Badge>
                      )}
                    </div>
                  )}
                  {cra?.statut === 'VALIDE' ? (
                    <Button 
                      className="w-full" 
                      variant="destructive"
                      onClick={devaliderCRA}
                      disabled={saving}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Dévalider pour modification
                    </Button>
                  ) : (
                    <>
                      <Button 
                        className="w-full" 
                        onClick={() => saveCRA(false)}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer brouillon
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="default"
                        onClick={() => saveCRA(true)}
                        disabled={saving || cra?.statut === 'SOUMIS'}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Soumettre pour validation
                      </Button>
                    </>
                  )}
                  <Button 
                    className="w-full" 
                    variant="outline"
                    disabled
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exporter PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
