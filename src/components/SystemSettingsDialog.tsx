import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, UserPlus, Trash2, Edit, Shield, Users, Mail, Eye, Plus, Save, X } from 'lucide-react';
import { Profile, UserRole } from '@/types/database';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface SystemSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const invitationSchema = z.object({
  email: z.string().email("Email invalide"),
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  role: z.enum(['ADMIN', 'RECRUTEUR', 'CANDIDAT']),
});

type InvitationFormValues = z.infer<typeof invitationSchema>;

const profileSchema = z.object({
  email: z.string().email("Email invalide"),
  nom: z.string().min(1, "Le nom est requis").max(100, "Le nom ne peut pas dépasser 100 caractères"),
  prenom: z.string().min(1, "Le prénom est requis").max(100, "Le prénom ne peut pas dépasser 100 caractères"),
  role: z.enum(['ADMIN', 'RECRUTEUR', 'CANDIDAT']),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function SystemSettingsDialog({ open, onOpenChange }: SystemSettingsDialogProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      nom: '',
      prenom: '',
      role: 'RECRUTEUR',
    },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: '',
      nom: '',
      prenom: '',
      role: 'RECRUTEUR',
    },
  });

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des profils:', error);
      toast.error('Impossible de charger les profils');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Rôle mis à jour avec succès');
      loadProfiles();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error);
      toast.error('Impossible de mettre à jour le rôle');
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ? Cette action est irréversible.')) {
      return;
    }

    try {
      // Supprimer uniquement le profil (l'utilisateur reste dans auth.users)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Profil supprimé avec succès');
      loadProfiles();
    } catch (error) {
      console.error('Erreur lors de la suppression du profil:', error);
      toast.error('Impossible de supprimer le profil');
    }
  };

  const handleSendInvitation = async (values: InvitationFormValues) => {
    setSendingInvite(true);
    try {
      // Si c'est un candidat, créer d'abord l'enregistrement dans la table candidats
      if (values.role === 'CANDIDAT') {
        const { data: candidat, error: candidatError } = await supabase
          .from('candidats')
          .insert({
            nom: values.nom,
            prenom: values.prenom,
            email: values.email,
          })
          .select()
          .single();

        if (candidatError) {
          if (candidatError.code === '23505') {
            toast.error('Un candidat avec cet email existe déjà');
            return;
          }
          throw candidatError;
        }

        // Envoyer l'invitation candidat
        const { error: inviteError } = await supabase.functions.invoke('send-candidat-invitation', {
          body: {
            candidatId: candidat.id,
            baseUrl: window.location.origin,
          },
        });

        if (inviteError) throw inviteError;
        toast.success('Invitation candidat envoyée avec succès');
      } else {
        // Pour les recruteurs et admins, envoyer une invitation directe
        const { error } = await supabase.functions.invoke('send-user-invitation', {
          body: {
            email: values.email,
            nom: values.nom,
            prenom: values.prenom,
            role: values.role,
            baseUrl: window.location.origin,
          },
        });

        if (error) throw error;
        toast.success(`Invitation ${values.role.toLowerCase()} envoyée avec succès`);
      }

      form.reset();
      loadProfiles();
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'invitation:', error);
      toast.error('Impossible d\'envoyer l\'invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSaveProfile = async (values: ProfileFormValues) => {
    try {
      if (editingProfile) {
        // Mise à jour du profil existant
        const { error } = await supabase
          .from('profiles')
          .update({
            nom: values.nom,
            prenom: values.prenom,
            role: values.role,
          })
          .eq('id', editingProfile.id);

        if (error) throw error;
        toast.success('Profil mis à jour avec succès');
      } else {
        // Création d'un nouveau profil (utilisateur doit exister dans auth.users)
        // Pour créer un profil, on doit d'abord créer un utilisateur via invitation
        toast.info('Pour créer un nouveau profil, utilisez l\'onglet "Envoyer une Invitation"');
      }

      setEditingProfile(null);
      setCreatingProfile(false);
      profileForm.reset();
      loadProfiles();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du profil:', error);
      toast.error('Impossible de sauvegarder le profil');
    }
  };

  const getRoleBadgeVariant = (role: UserRole | 'CANDIDAT') => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'RECRUTEUR':
        return 'default';
      case 'CANDIDAT':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: UserRole | 'CANDIDAT') => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="h-3 w-3 mr-1" />;
      case 'RECRUTEUR':
        return <Users className="h-3 w-3 mr-1" />;
      case 'CANDIDAT':
        return <Mail className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres Système</DialogTitle>
          <DialogDescription>
            Gérez les profils utilisateurs et envoyez des invitations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profiles" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profiles">Profils Utilisateurs</TabsTrigger>
            <TabsTrigger value="invitation">Envoyer une Invitation</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Profils</CardTitle>
                <CardDescription>
                  Modifiez les rôles et gérez les accès des utilisateurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Chargement des profils...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Date de création</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">
                            {editingProfile?.id === profile.id ? (
                              <Input
                                value={profileForm.watch('email')}
                                disabled
                                className="w-full"
                              />
                            ) : (
                              profile.email
                            )}
                          </TableCell>
                          <TableCell>
                            {editingProfile?.id === profile.id ? (
                              <Input
                                {...profileForm.register('nom')}
                                className="w-full"
                              />
                            ) : (
                              profile.nom
                            )}
                          </TableCell>
                          <TableCell>
                            {editingProfile?.id === profile.id ? (
                              <Input
                                {...profileForm.register('prenom')}
                                className="w-full"
                              />
                            ) : (
                              profile.prenom
                            )}
                          </TableCell>
                          <TableCell>
                            {editingProfile?.id === profile.id ? (
                              profile.role === 'CANDIDAT' ? (
                                <Badge variant={getRoleBadgeVariant('CANDIDAT')}>
                                  {getRoleIcon('CANDIDAT')}
                                  Candidat
                                </Badge>
                              ) : (
                                <Select
                                  value={profileForm.watch('role')}
                                  onValueChange={(value) => profileForm.setValue('role', value as UserRole)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ADMIN">
                                      <div className="flex items-center">
                                        {getRoleIcon('ADMIN')}
                                        Admin
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="RECRUTEUR">
                                      <div className="flex items-center">
                                        {getRoleIcon('RECRUTEUR')}
                                        Recruteur
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )
                            ) : profile.role === 'CANDIDAT' ? (
                              <Badge variant={getRoleBadgeVariant('CANDIDAT')}>
                                {getRoleIcon('CANDIDAT')}
                                Candidat
                              </Badge>
                            ) : (
                              <Select
                                value={profile.role}
                                onValueChange={(value) => handleRoleChange(profile.id, value as UserRole)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">
                                    <div className="flex items-center">
                                      {getRoleIcon('ADMIN')}
                                      Admin
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="RECRUTEUR">
                                    <div className="flex items-center">
                                      {getRoleIcon('RECRUTEUR')}
                                      Recruteur
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {profile.created_at && new Date(profile.created_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {editingProfile?.id === profile.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => profileForm.handleSubmit(handleSaveProfile)()}
                                  >
                                    <Save className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingProfile(null);
                                      profileForm.reset();
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingProfile(profile)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingProfile(profile);
                                      profileForm.reset({
                                        email: profile.email,
                                        nom: profile.nom,
                                        prenom: profile.prenom,
                                        role: profile.role,
                                      });
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteProfile(profile.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Envoyer une Invitation</CardTitle>
                <CardDescription>
                  Invitez un nouvel utilisateur en spécifiant son rôle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSendInvitation)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="prenom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl>
                              <Input placeholder="Jean" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl>
                              <Input placeholder="Dupont" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="jean.dupont@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rôle</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez un rôle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ADMIN">
                                <div className="flex items-center">
                                  {getRoleIcon('ADMIN')}
                                  Administrateur
                                </div>
                              </SelectItem>
                              <SelectItem value="RECRUTEUR">
                                <div className="flex items-center">
                                  {getRoleIcon('RECRUTEUR')}
                                  Recruteur
                                </div>
                              </SelectItem>
                              <SelectItem value="CANDIDAT">
                                <div className="flex items-center">
                                  {getRoleIcon('CANDIDAT')}
                                  Candidat
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={sendingInvite} className="w-full">
                      <Send className="mr-2 h-4 w-4" />
                      {sendingInvite ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Dialog de visualisation du profil */}
      {viewingProfile && (
        <Dialog open={!!viewingProfile} onOpenChange={() => setViewingProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détails du Profil</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Email</Label>
                <p className="font-medium">{viewingProfile.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Prénom</Label>
                  <p className="font-medium">{viewingProfile.prenom}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Nom</Label>
                  <p className="font-medium">{viewingProfile.nom}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Rôle</Label>
                <Badge variant={getRoleBadgeVariant(viewingProfile.role)} className="mt-1">
                  {getRoleIcon(viewingProfile.role)}
                  {viewingProfile.role}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Date de création</Label>
                  <p className="font-medium">
                    {viewingProfile.created_at && new Date(viewingProfile.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Dernière mise à jour</Label>
                  <p className="font-medium">
                    {viewingProfile.updated_at && new Date(viewingProfile.updated_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}