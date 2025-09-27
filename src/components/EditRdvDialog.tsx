import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Edit, Calendar, Clock, MapPin, Users, Phone, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EditRdvDialogProps {
  rdv: any;
  onSuccess: () => void;
}

export function EditRdvDialog({ rdv, onSuccess }: EditRdvDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidats, setCandidats] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [postes, setPostes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [referents, setReferents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    type_rdv: '',
    rdv_type: '',
    candidat_id: '',
    client_id: '',
    poste_id: '',
    lieu: '',
    notes: '',
    recruteur_id: '',
    referent_ids: [] as string[], // Changé pour gérer plusieurs référents
    statut: '',
    teamsEmails: '',
  });

  useEffect(() => {
    if (open) {
      loadData();
      // Initialize form with RDV data
      const dateObj = new Date(rdv.date);
      setFormData({
        date: format(dateObj, "yyyy-MM-dd'T'HH:mm"),
        type_rdv: rdv.type_rdv || '',
        rdv_type: rdv.rdv_type || 'RECRUTEUR',
        candidat_id: rdv.candidat_id || '',
        client_id: rdv.client_id || '',
        poste_id: rdv.poste_id || '',
        lieu: rdv.lieu || '',
        notes: rdv.notes || '',
        recruteur_id: rdv.recruteur_id || '',
        referent_ids: [], // On chargera les référents après
        statut: rdv.statut || 'ENCOURS',
        teamsEmails: '',
      });
      // Charger les référents liés au rendez-vous
      loadRdvReferents();
    }
  }, [open, rdv]);

  const loadRdvReferents = async () => {
    if (!rdv?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('rdv_referents')
        .select('referent_id')
        .eq('rdv_id', rdv.id);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          referent_ids: data.map(r => r.referent_id)
        }));
      }
    } catch (error) {
      console.error('Error loading rdv referents:', error);
    }
  };

  const loadData = async () => {
    try {
      const [candidatsRes, clientsRes, profilesRes] = await Promise.all([
        supabase.from('candidats').select('*').order('nom'),
        supabase.from('clients').select('*').order('raison_sociale'),
        supabase.from('profiles').select('*').order('nom'),
      ]);

      if (candidatsRes.data) setCandidats(candidatsRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data.filter(p => p.role === 'RECRUTEUR'));
      
      // Load postes for the current client if any
      if (rdv.client_id) {
        const { data: postesData } = await supabase
          .from('postes')
          .select('id, titre, statut')
          .eq('client_id', rdv.client_id)
          .order('titre');
        setPostes(postesData || []);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadReferentsByClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('referents')
        .select('*')
        .eq('client_id', clientId)
        .order('nom');

      if (error) throw error;
      setReferents(data || []);
      
      // On ne réinitialise pas les référents sélectionnés
      
      // Load postes for this client
      const { data: postesData } = await supabase
        .from('postes')
        .select('id, titre, statut')
        .eq('client_id', clientId)
        .order('titre');
      setPostes(postesData || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (formData.client_id && formData.rdv_type === 'CLIENT') {
      loadReferentsByClient(formData.client_id);
    } else {
      setReferents([]);
      setFormData(prev => ({ ...prev, referent_id: '' }));
    }
  }, [formData.client_id, formData.rdv_type]);

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
      const recruteur = profiles.find(p => p.id === formData.recruteur_id);
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
  }, [formData.type_rdv, formData.candidat_id, formData.rdv_type, formData.referent_ids, formData.recruteur_id, candidats, referents, profiles]);

  const generateEmailMessage = (rdv: any, teamsLink: string) => {
    const date = format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr });
    const type = rdv.type_rdv === 'TEAMS' ? 'Microsoft Teams' : 
                 rdv.type_rdv === 'PRESENTIEL_CLIENT' ? 'Présentiel' : 'Téléphone';
    
    return `Bonjour,

Je vous informe que notre rendez-vous a été mis à jour.

Nouvelle date : ${date}
Type de rendez-vous : ${type}
${rdv.lieu ? `Lieu : ${rdv.lieu}` : ''}
${rdv.notes ? `\nNotes : ${rdv.notes}` : ''}

${rdv.type_rdv === 'TEAMS' && teamsLink ? `
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare update data
      const updateData: any = {
        date: new Date(formData.date).toISOString(),
        type_rdv: formData.type_rdv,
        rdv_type: formData.rdv_type,
        candidat_id: formData.candidat_id || null,
        client_id: formData.client_id || null,
        poste_id: formData.poste_id || null,
        lieu: formData.lieu || null,
        notes: formData.notes || null,
        statut: formData.statut,
        recruteur_id: formData.rdv_type === 'RECRUTEUR' ? formData.recruteur_id : null,
        // Ne pas inclure referent_id ici, on utilisera rdv_referents
      };

      // Update RDV
      const { error } = await supabase
        .from('rdvs')
        .update(updateData)
        .eq('id', rdv.id);

      if (error) throw error;

      // Mettre à jour les référents
      // D'abord supprimer les anciens liens
      await supabase
        .from('rdv_referents')
        .delete()
        .eq('rdv_id', rdv.id);

      // Puis ajouter les nouveaux
      if (formData.rdv_type === 'CLIENT' && formData.referent_ids.length > 0) {
        const referentLinks = formData.referent_ids.map(referent_id => ({
          rdv_id: rdv.id,
          referent_id
        }));

        const { error: referentError } = await supabase
          .from('rdv_referents')
          .insert(referentLinks);

        if (referentError) throw referentError;
      }

      // Handle Teams meeting creation or update
      if (formData.type_rdv === 'TEAMS') {
        // Collect attendee emails
        const attendees = [];
        
        // Add candidate email if exists
        const candidat = candidats.find(c => c.id === formData.candidat_id);
        if (candidat?.email) attendees.push(candidat.email);
        
        // Add client referent emails if exists  
        if (formData.rdv_type === 'CLIENT' && formData.referent_ids.length > 0) {
          formData.referent_ids.forEach(referentId => {
            const referent = referents.find(r => r.id === referentId);
            if (referent?.email) attendees.push(referent.email);
          });
        }
        
        // Add additional emails
        if (formData.teamsEmails) {
          const additionalEmails = formData.teamsEmails
            .split(/[,;\n]/)
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));
          attendees.push(...additionalEmails);
        }

        // If no Teams link exists, create one
        if (!rdv.teams_link) {
          const { data: meetingData, error: meetingError } = await supabase.functions.invoke('create-teams-meeting', {
            body: {
              rdvId: rdv.id,
              startDateTime: updateData.date,
              endDateTime: new Date(new Date(updateData.date).getTime() + 60 * 60 * 1000).toISOString(),
              subject: `Entretien - ${candidat?.prenom} ${candidat?.nom} - ${clients.find(c => c.id === formData.client_id)?.raison_sociale}`,
              attendees
            }
          });

          if (!meetingError && meetingData?.joinUrl) {
            toast({
              title: "Lien Teams créé",
              description: "Le lien de réunion Teams a été généré avec succès.",
            });
          }
        }

        // Send updated invitations to all attendees
        if (attendees.length > 0) {
          // Get the latest RDV data with Teams link
          const { data: updatedRdv } = await supabase
            .from('rdvs')
            .select('*, candidat:candidats(*), client:clients(*)')
            .eq('id', rdv.id)
            .single();
            
          if (updatedRdv) {
            const { error: emailError } = await supabase.functions.invoke('teams-integration', {
              body: {
                action: 'send-invitation',
                data: {
                  rdv: updatedRdv,
                  recipients: attendees,
                  message: generateEmailMessage(updatedRdv, updatedRdv.teams_link || '')
                }
              }
            });
            
            if (!emailError) {
              toast({
                title: "Invitations mises à jour",
                description: `${attendees.length} invitation(s) envoyée(s) par email`,
              });
            }
          }
        }
      }

      toast({
        title: "Succès",
        description: "Rendez-vous modifié avec succès",
      });
      
      onSuccess();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle>Modifier le rendez-vous</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Date et heure */}
            <div>
              <Label htmlFor="date">
                <Calendar className="inline h-4 w-4 mr-1" />
                Date et heure
              </Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            {/* Statut */}
            <div>
              <Label htmlFor="statut">Statut</Label>
              <Select
                value={formData.statut}
                onValueChange={(value) => setFormData({ ...formData, statut: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENCOURS">En cours</SelectItem>
                  <SelectItem value="REALISE">Réalisé</SelectItem>
                  <SelectItem value="TERMINE">Terminé</SelectItem>
                  <SelectItem value="ANNULE">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type de RDV */}
            <div>
              <Label htmlFor="rdv_type">Type de rendez-vous</Label>
              <Select
                value={formData.rdv_type}
                onValueChange={(value) => setFormData({ ...formData, rdv_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type de RDV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECRUTEUR">Recruteur</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modalité */}
            <div>
              <Label htmlFor="type_rdv">
                {formData.type_rdv === 'TEAMS' && <Video className="inline h-4 w-4 mr-1" />}
                {formData.type_rdv === 'TELEPHONE' && <Phone className="inline h-4 w-4 mr-1" />}
                {formData.type_rdv === 'PRESENTIEL_CLIENT' && <MapPin className="inline h-4 w-4 mr-1" />}
                Modalité
              </Label>
              <Select
                value={formData.type_rdv}
                onValueChange={(value) => {
                  setFormData({ ...formData, type_rdv: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Modalité du RDV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEAMS">Teams</SelectItem>
                  <SelectItem value="PRESENTIEL_CLIENT">Présentiel chez le client</SelectItem>
                  <SelectItem value="TELEPHONE">Téléphone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Candidat */}
            <div>
              <Label htmlFor="candidat_id">Candidat</Label>
              <Select
                value={formData.candidat_id}
                onValueChange={(value) => setFormData({ ...formData, candidat_id: value })}
              >
                <SelectTrigger>
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

            {/* Client */}
            <div>
              <Label htmlFor="client_id">Client</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
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

            {/* Recruteur (si type RECRUTEUR) */}
            {formData.rdv_type === 'RECRUTEUR' && (
              <div>
                <Label htmlFor="recruteur_id">Recruteur</Label>
                <Select
                  value={formData.recruteur_id}
                  onValueChange={(value) => setFormData({ ...formData, recruteur_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un recruteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.prenom} {profile.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Référents (si type CLIENT) */}
            {formData.rdv_type === 'CLIENT' && (
              <div>
                <Label htmlFor="referents">Référents</Label>
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
                    {formData.rdv_type === 'RECRUTEUR' && formData.recruteur_id && profiles.find(r => r.id === formData.recruteur_id)?.email && (
                      <li>Recruteur : {profiles.find(r => r.id === formData.recruteur_id)?.email}</li>
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
                Lieu / Détails
              </Label>
              <Input
                id="lieu"
                value={formData.lieu}
                onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                placeholder={formData.type_rdv === 'TELEPHONE' ? "Numéro de téléphone" : "Adresse"}
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
              placeholder="Notes additionnelles..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Modification...' : 'Modifier'}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
