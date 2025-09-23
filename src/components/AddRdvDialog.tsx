import { useState } from 'react';
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
import { toast } from 'sonner';
import { Plus, Calendar, Users, MapPin } from 'lucide-react';
import { Candidat, Client, Rdv } from '@/types/models';
import { rdvService } from '@/services';
import { format } from 'date-fns';

interface AddRdvDialogProps {
  candidats: Candidat[];
  clients: Client[];
  onSuccess: () => void;
}

export default function AddRdvDialog({ candidats, clients, onSuccess }: AddRdvDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    candidatId: '',
    clientId: '',
    date: '',
    time: '',
    typeRdv: 'TEAMS' as Rdv['typeRdv'],
    statut: 'ENCOURS' as Rdv['statut'],
    lieu: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!formData.candidatId || !formData.clientId || !formData.date || !formData.time) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      const datetime = new Date(`${formData.date}T${formData.time}`);
      
      await rdvService.create({
        candidatId: formData.candidatId,
        clientId: formData.clientId,
        date: datetime,
        typeRdv: formData.typeRdv,
        statut: formData.statut,
        lieu: formData.lieu || undefined,
        notes: formData.notes || undefined,
      });

      toast.success('Rendez-vous créé avec succès');
      setIsOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      toast.error('Erreur lors de la création du rendez-vous');
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      candidatId: '',
      clientId: '',
      date: '',
      time: '',
      typeRdv: 'TEAMS',
      statut: 'ENCOURS',
      lieu: '',
      notes: '',
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Nouveau RDV
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Créer un nouveau rendez-vous
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="candidat">Candidat *</Label>
                <Select
                  value={formData.candidatId}
                  onValueChange={(value) => setFormData({ ...formData, candidatId: value })}
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
                  value={formData.clientId}
                  onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.raisonSociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type de rendez-vous *</Label>
                <Select
                  value={formData.typeRdv}
                  onValueChange={(value) => setFormData({ ...formData, typeRdv: value as Rdv['typeRdv'] })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAMS">Microsoft Teams</SelectItem>
                    <SelectItem value="PRESENTIEL_CLIENT">Présentiel chez le client</SelectItem>
                    <SelectItem value="TELEPHONE">Téléphonique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="statut">Statut *</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(value) => setFormData({ ...formData, statut: value as Rdv['statut'] })}
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

            {(formData.typeRdv === 'PRESENTIEL_CLIENT' || formData.typeRdv === 'TELEPHONE') && (
              <div>
                <Label htmlFor="lieu">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Lieu {formData.typeRdv === 'PRESENTIEL_CLIENT' && '*'}
                </Label>
                <Input
                  id="lieu"
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                  placeholder={formData.typeRdv === 'PRESENTIEL_CLIENT' ? 'Adresse du rendez-vous' : 'Optionnel'}
                />
              </div>
            )}

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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Création...' : 'Créer le rendez-vous'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}