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

interface EditRdvDialogProps {
  rdv: any;
  onSuccess: () => void;
}

export function EditRdvDialog({ rdv, onSuccess }: EditRdvDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidats, setCandidats] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [referents, setReferents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    type_rdv: '',
    rdv_type: '',
    candidat_id: '',
    client_id: '',
    lieu: '',
    notes: '',
    recruteur_id: '',
    referent_id: '',
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
        lieu: rdv.lieu || '',
        notes: rdv.notes || '',
        recruteur_id: rdv.recruteur_id || '',
        referent_id: rdv.referent_id || '',
        statut: rdv.statut || 'ENCOURS',
        teamsEmails: '',
      });
    }
  }, [open, rdv]);

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
      
      // Keep existing referent if it belongs to the new client
      const existingReferentInNewClient = data?.find(r => r.id === formData.referent_id);
      if (!existingReferentInNewClient) {
        setFormData(prev => ({ ...prev, referent_id: '' }));
      }
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
        lieu: formData.lieu || null,
        notes: formData.notes || null,
        statut: formData.statut,
        recruteur_id: formData.rdv_type === 'RECRUTEUR' ? formData.recruteur_id : null,
        referent_id: formData.rdv_type === 'CLIENT' ? formData.referent_id : null,
      };

      // Update RDV
      const { error } = await supabase
        .from('rdvs')
        .update(updateData)
        .eq('id', rdv.id);

      if (error) throw error;

      // If Teams meeting and emails changed, update the meeting
      if (formData.type_rdv === 'TEAMS' && formData.teamsEmails && rdv.teams_link) {
        // Collect attendee emails
        const attendees = [];
        
        // Add candidate email if exists
        const candidat = candidats.find(c => c.id === formData.candidat_id);
        if (candidat?.email) attendees.push(candidat.email);
        
        // Add client referent email if exists
        if (formData.rdv_type === 'CLIENT' && formData.referent_id) {
          const referent = referents.find(r => r.id === formData.referent_id);
          if (referent?.email) attendees.push(referent.email);
        }
        
        // Add additional emails
        if (formData.teamsEmails) {
          const additionalEmails = formData.teamsEmails
            .split(/[,;\n]/)
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));
          attendees.push(...additionalEmails);
        }

        // Note: In a real scenario, you would update the Teams meeting here
        // For now, we just show a message that the Teams link remains the same
        toast({
          title: "Information",
          description: "Le lien Teams existant reste valide. Pour changer les participants, créez un nouveau RDV.",
        });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le rendez-vous</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                onValueChange={(value) => setFormData({ ...formData, type_rdv: value })}
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

            {/* Référent (si type CLIENT) */}
            {formData.rdv_type === 'CLIENT' && (
              <div>
                <Label htmlFor="referent_id">Référent</Label>
                <Select
                  value={formData.referent_id}
                  onValueChange={(value) => setFormData({ ...formData, referent_id: value })}
                  disabled={!formData.client_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.client_id ? "Sélectionner un référent" : "Sélectionnez d'abord un client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {referents.map((referent) => (
                      <SelectItem key={referent.id} value={referent.id}>
                        {referent.prenom} {referent.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Emails pour Teams */}
          {formData.type_rdv === 'TEAMS' && (
            <div>
              <Label htmlFor="teamsEmails">
                <Users className="inline h-4 w-4 mr-1" />
                Emails des participants supplémentaires
              </Label>
              <Textarea
                id="teamsEmails"
                value={formData.teamsEmails}
                onChange={(e) => setFormData({ ...formData, teamsEmails: e.target.value })}
                placeholder="Entrez les emails des participants (séparés par des virgules, points-virgules ou retours à la ligne)"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Note: Le lien Teams existant reste valide. Pour changer les participants, créez un nouveau RDV.
              </p>
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
      </DialogContent>
    </Dialog>
  );
}
