import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Calendar, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RdvType } from '@/types/database';
import { Video } from 'lucide-react';

interface AddRdvDialogProps {
  onSuccess: () => void;
  currentUserId?: string;
}

export function AddRdvDialog({ onSuccess, currentUserId }: AddRdvDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [candidats, setCandidats] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [postes, setPostes] = useState<any[]>([]);
  const [referents, setReferents] = useState<any[]>([]);
  const [recruteurs, setRecruteurs] = useState<any[]>([]);
  const [creatingTeamsMeeting, setCreatingTeamsMeeting] = useState(false);
  
  const [formData, setFormData] = useState({
    candidat_id: '',
    client_id: '',
    poste_id: '',
    date: '',
    time: '',
    type_rdv: 'TEAMS',
    rdv_type: 'RECRUTEUR' as RdvType,
    statut: 'ENCOURS',
    lieu: '',
    notes: '',
    recruteur_id: currentUserId || '',
    referent_ids: [] as string[], // Changé pour gérer plusieurs référents
    teamsEmails: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen]);

  useEffect(() => {
    // Charger les postes quand un client est sélectionné
    if (formData.client_id) {
      loadPostesForClient(formData.client_id);
    }
  }, [formData.client_id]);

  useEffect(() => {
    // Charger les référents quand un client est sélectionné et le type est CLIENT
    if (formData.client_id && formData.rdv_type === 'CLIENT') {
      loadReferentsForClient(formData.client_id);
    }
  }, [formData.client_id, formData.rdv_type]);

  const loadFormData = async () => {
    try {
      // Charger les candidats
      const { data: candidatsData } = await supabase
        .from('candidats')
        .select('id, nom, prenom, email')
        .order('nom');
      setCandidats(candidatsData || []);

      // Charger les clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, raison_sociale')
        .order('raison_sociale');
      setClients(clientsData || []);

      // Charger les recruteurs (profiles)
      const { data: recruteursData } = await supabase
        .from('profiles')
        .select('id, nom, prenom, role')
        .order('nom');
      setRecruteurs(recruteursData || []);

      // Set current user as default recruteur
      if (currentUserId) {
        setFormData(prev => ({ ...prev, recruteur_id: currentUserId }));
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadPostesForClient = async (clientId: string) => {
    try {
      const { data } = await supabase
        .from('postes')
        .select('id, titre, statut')
        .eq('client_id', clientId)
        .eq('statut', 'ENCOURS')
        .order('titre');
      setPostes(data || []);
    } catch (error: any) {
      console.error('Erreur chargement postes:', error);
    }
  };

  const loadReferentsForClient = async (clientId: string) => {
    try {
      const { data } = await supabase
        .from('referents')
        .select('id, nom, prenom')
        .eq('client_id', clientId)
        .order('nom');
      setReferents(data || []);
    } catch (error: any) {
      console.error('Erreur chargement référents:', error);
    }
  };

  const generateEmailMessage = (rdv: any, teamsLink: string) => {
    const date = format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr });
    const type = rdv.type_rdv === 'TEAMS' ? 'Microsoft Teams' : 
                 rdv.type_rdv === 'PRESENTIEL_CLIENT' ? 'Présentiel' : 'Téléphone';
    
    return `Bonjour,

Je vous confirme notre rendez-vous prévu le ${date}.

Type de rendez-vous : ${type}
${rdv.lieu ? `Lieu : ${rdv.lieu}` : ''}
${rdv.notes ? `\nNotes : ${rdv.notes}` : ''}

${rdv.type_rdv === 'TEAMS' ? `
Lien de la réunion Teams :
${teamsLink}

Comment rejoindre la réunion :
1. Cliquez sur le lien ci-dessus
2. Rejoignez depuis votre navigateur ou l'application Teams
3. Activez votre caméra et microphone

` : ''}
Cordialement,
L'équipe de recrutement`;
  };

  // Fonction pour mettre à jour automatiquement les emails participants
  const updateTeamsEmails = () => {
    if (formData.type_rdv !== 'TEAMS') return;
    
    const emails = new Set<string>();
    
    // Ajouter l'email du candidat
    const candidat = candidats.find(c => c.id === formData.candidat_id);
    if (candidat?.email) emails.add(candidat.email);
    
    // Ajouter les emails selon le type de RDV
    if (formData.rdv_type === 'CLIENT') {
      // Ajouter les emails des référents sélectionnés
      formData.referent_ids.forEach(referentId => {
        const referent = referents.find(r => r.id === referentId);
        if (referent?.email) emails.add(referent.email);
      });
    } else if (formData.rdv_type === 'RECRUTEUR') {
      // Ajouter l'email du recruteur
      const recruteur = recruteurs.find(r => r.id === formData.recruteur_id);
      if (recruteur?.email) emails.add(recruteur.email);
    }
    
    // Conserver les emails supplémentaires déjà saisis
    const currentEmails = formData.teamsEmails
      .split(/[,;\n]/)
      .map(e => e.trim())
      .filter(e => e && !emails.has(e));
    
    // Combiner tous les emails
    const allEmails = [...emails, ...currentEmails];
    setFormData(prev => ({ ...prev, teamsEmails: allEmails.join(', ') }));
  };

  // Appeler updateTeamsEmails quand les dépendances changent
  useEffect(() => {
    updateTeamsEmails();
  }, [formData.type_rdv, formData.candidat_id, formData.rdv_type, formData.referent_ids, formData.recruteur_id]);

  const createTeamsMeetingIfNeeded = async (rdvId: string, rdvData: any) => {
    if (rdvData.type_rdv !== 'TEAMS') {
      return null;
    }

    setCreatingTeamsMeeting(true);
    try {
      // Get candidat and client emails
      const candidat = candidats.find(c => c.id === rdvData.candidat_id);
      const client = clients.find(c => c.id === rdvData.client_id);
      
      const attendees = [];
      if (candidat?.email) attendees.push(candidat.email);
      
      // Add referent email if RDV type is CLIENT
      if (rdvData.rdv_type === 'CLIENT' && rdvData.referent_id) {
        const referent = referents.find(r => r.id === rdvData.referent_id);
        if (referent?.email) attendees.push(referent.email);
      }
      
      // Add additional emails from the Teams emails field
      if (formData.teamsEmails) {
        const additionalEmails = formData.teamsEmails
          .split(/[,;\n]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
        attendees.push(...additionalEmails);
      }

      // Calculate end time (1 hour after start)
      const startDate = new Date(rdvData.date);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      const meetingDetails = {
        rdvId,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
        subject: `Entretien - ${candidat?.prenom} ${candidat?.nom} - ${client?.raison_sociale}`,
        attendees
      };

      console.log('Creating Teams meeting with details:', meetingDetails);

      const { data, error } = await supabase.functions.invoke('create-teams-meeting', {
        body: meetingDetails
      });

      if (error) {
        console.error('Error creating Teams meeting:', error);
        toast({
          title: "Avertissement",
          description: "Le RDV a été créé mais le lien Teams n'a pas pu être généré. Vous pouvez le créer manuellement.",
          variant: "destructive",
        });
        return null;
      }

      if (data?.joinUrl) {
        toast({
          title: "Lien Teams créé",
          description: "Le lien de réunion Teams a été généré avec succès.",
        });
        
        // Send email invitations if there are attendees
        if (attendees.length > 0) {
          const rdvDetails = await supabase
            .from('rdvs')
            .select('*, candidat:candidats(*), client:clients(*)')
            .eq('id', rdvId)
            .single();
            
          if (rdvDetails.data) {
            const { error: emailError } = await supabase.functions.invoke('teams-integration', {
              body: {
                action: 'send-invitation',
                data: {
                  rdv: rdvDetails.data,
                  recipients: attendees,
                  message: generateEmailMessage(rdvDetails.data, data.joinUrl)
                }
              }
            });
            
            if (!emailError) {
              toast({
                title: "Invitations envoyées",
                description: `${attendees.length} invitation(s) envoyée(s) par email`,
              });
            }
          }
        }
        
        return data.joinUrl;
      }

      return null;
    } catch (error) {
      console.error('Error in Teams meeting creation:', error);
      toast({
        title: "Avertissement",
        description: "Le RDV a été créé mais le lien Teams n'a pas pu être généré.",
        variant: "destructive",
      });
      return null;
    } finally {
      setCreatingTeamsMeeting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.candidat_id || !formData.client_id || !formData.date || !formData.time) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    // Vérifier qu'au moins un référent est sélectionné si type CLIENT
    if (formData.rdv_type === 'CLIENT' && formData.referent_ids.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un référent pour un RDV client",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const datetime = new Date(`${formData.date}T${formData.time}`);
      
      const rdvData: any = {
        candidat_id: formData.candidat_id,
        client_id: formData.client_id,
        poste_id: formData.poste_id || null,
        date: datetime.toISOString(),
        type_rdv: formData.type_rdv,
        rdv_type: formData.rdv_type,
        statut: formData.statut,
        lieu: formData.lieu || null,
        notes: formData.notes || null,
        recruteur_id: formData.recruteur_id || null,
        // Ne pas inclure referent_id ici, on utilisera rdv_referents
      };

      const { data: newRdv, error } = await supabase
        .from('rdvs')
        .insert([rdvData])
        .select()
        .single();

      if (error) throw error;

      // Ajouter les référents si type CLIENT
      if (formData.rdv_type === 'CLIENT' && formData.referent_ids.length > 0) {
        const referentLinks = formData.referent_ids.map(referent_id => ({
          rdv_id: newRdv.id,
          referent_id
        }));

        const { error: referentError } = await supabase
          .from('rdv_referents')
          .insert(referentLinks);

        if (referentError) throw referentError;
      }

      if (error) throw error;

      // Create Teams meeting if needed
      if (formData.type_rdv === 'TEAMS' && newRdv) {
        await createTeamsMeetingIfNeeded(newRdv.id, rdvData);
      }

      toast({
        title: "Succès",
        description: "Rendez-vous créé avec succès",
      });
      setIsOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      candidat_id: '',
      client_id: '',
      poste_id: '',
      date: '',
      time: '',
      type_rdv: 'TEAMS',
      rdv_type: 'RECRUTEUR',
      statut: 'ENCOURS',
      lieu: '',
      notes: '',
      recruteur_id: currentUserId || '',
      referent_ids: [],
      teamsEmails: '',
    });
    setReferents([]);
    setPostes([]);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Nouveau RDV
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Créer un nouveau rendez-vous
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="rdv_type">Type de rendez-vous *</Label>
              <Select
                value={formData.rdv_type}
                onValueChange={(value: RdvType) => {
                  setFormData({ ...formData, rdv_type: value, referent_ids: [] });
                  setReferents([]);
                }}
              >
                <SelectTrigger id="rdv_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECRUTEUR">RDV Recruteur</SelectItem>
                  <SelectItem value="CLIENT">RDV Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Candidat et Client */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="candidat">Candidat *</Label>
                <Select
                  value={formData.candidat_id}
                  onValueChange={(value) => setFormData({ ...formData, candidat_id: value })}
                >
                  <SelectTrigger id="candidat">
                    <SelectValue placeholder="Sélectionner un candidat" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidats.map((candidat) => (
                      <SelectItem key={candidat.id} value={candidat.id}>
                        {candidat.prenom} {candidat.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="client">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Poste associé */}
            <div>
              <Label htmlFor="poste">Poste</Label>
              <Select
                value={formData.poste_id}
                onValueChange={(value) => setFormData({ ...formData, poste_id: value })}
                disabled={!formData.client_id}
              >
                <SelectTrigger id="poste">
                  <SelectValue placeholder={
                    !formData.client_id 
                      ? "Sélectionnez d'abord un client" 
                      : postes.length === 0 
                        ? "Aucun poste ouvert pour ce client"
                        : "Sélectionner un poste (optionnel)"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {postes.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recruteur ou Référent selon le type */}
            {formData.rdv_type === 'RECRUTEUR' ? (
              <div>
                <Label htmlFor="recruteur">Recruteur *</Label>
                <Select
                  value={formData.recruteur_id}
                  onValueChange={(value) => setFormData({ ...formData, recruteur_id: value })}
                >
                  <SelectTrigger id="recruteur">
                    <SelectValue placeholder="Sélectionner un recruteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {recruteurs.map((recruteur) => (
                      <SelectItem key={recruteur.id} value={recruteur.id}>
                        {recruteur.prenom} {recruteur.nom} ({recruteur.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="referents">Référents client *</Label>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {!formData.client_id ? (
                      "Sélectionnez d'abord un client"
                    ) : referents.length === 0 ? (
                      "Aucun référent pour ce client"
                    ) : (
                      "Sélectionnez un ou plusieurs référents"
                    )}
                  </div>
                  {formData.client_id && referents.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md">
                      {referents.map((referent) => (
                        <label
                          key={referent.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={formData.referent_ids.includes(referent.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  referent_ids: [...formData.referent_ids, referent.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  referent_ids: formData.referent_ids.filter(id => id !== referent.id)
                                });
                              }
                            }}
                          />
                          <span className="text-sm">
                            {referent.prenom} {referent.nom}
                            {referent.fonction && ` - ${referent.fonction}`}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {formData.referent_ids.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {formData.referent_ids.length} référent(s) sélectionné(s)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date et Heure */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <Label htmlFor="time">Heure *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            {/* Modalité et Statut */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Modalité *</Label>
                <Select
                  value={formData.type_rdv}
                  onValueChange={(value) => {
                    setFormData({ ...formData, type_rdv: value });
                  }}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAMS">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Microsoft Teams
                      </div>
                    </SelectItem>
                    <SelectItem value="PRESENTIEL_CLIENT">Présentiel chez le client</SelectItem>
                    <SelectItem value="TELEPHONIQUE">Téléphonique</SelectItem>
                  </SelectContent>
                </Select>
                {formData.type_rdv === 'TEAMS' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Un lien Teams sera automatiquement créé
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="statut">Statut *</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(value) => setFormData({ ...formData, statut: value })}
                >
                  <SelectTrigger id="statut">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENCOURS">En cours</SelectItem>
                    <SelectItem value="REALISE">Réalisé</SelectItem>
                    <SelectItem value="TERMINE">Terminé</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Emails pour Teams */}
            {formData.type_rdv === 'TEAMS' && (
              <div>
                <Label htmlFor="teamsEmails">
                  <Users className="inline h-4 w-4 mr-1" />
                  Emails des participants
                </Label>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <p className="font-medium mb-1">Participants automatiquement ajoutés :</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {formData.candidat_id && candidats.find(c => c.id === formData.candidat_id)?.email && (
                        <li>Candidat : {candidats.find(c => c.id === formData.candidat_id)?.email}</li>
                      )}
                      {formData.rdv_type === 'CLIENT' && formData.referent_ids.length > 0 && (
                        <li>Référents : {formData.referent_ids.map(id => {
                          const ref = referents.find(r => r.id === id);
                          return ref?.email;
                        }).filter(Boolean).join(', ')}</li>
                      )}
                      {formData.rdv_type === 'RECRUTEUR' && formData.recruteur_id && recruteurs.find(r => r.id === formData.recruteur_id)?.email && (
                        <li>Recruteur : {recruteurs.find(r => r.id === formData.recruteur_id)?.email}</li>
                      )}
                    </ul>
                  </div>
                  <Textarea
                    id="teamsEmails"
                    value={formData.teamsEmails}
                    onChange={(e) => setFormData({ ...formData, teamsEmails: e.target.value })}
                    placeholder="Ajouter des emails supplémentaires (séparés par des virgules, points-virgules ou retours à la ligne)"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Lieu */}
            {(formData.type_rdv === 'PRESENTIEL_CLIENT' || formData.type_rdv === 'TELEPHONE') && (
              <div>
                <Label htmlFor="lieu">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Lieu {formData.type_rdv === 'PRESENTIEL_CLIENT' && '*'}
                </Label>
                <Input
                  id="lieu"
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                  placeholder={formData.type_rdv === 'PRESENTIEL_CLIENT' ? 'Adresse du rendez-vous' : 'Optionnel'}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes supplémentaires..."
                rows={3}
              />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || creatingTeamsMeeting}>
              {isLoading ? 'Création...' : creatingTeamsMeeting ? 'Génération du lien Teams...' : 'Créer le rendez-vous'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}