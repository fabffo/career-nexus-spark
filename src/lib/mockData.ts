import { Candidat, Client, Rdv, PosteClient, CommentaireCandidatParCollaborateur, CommentaireCandidatParClient } from '@/types/models';

// Mock data for development
export const mockCandidats: Candidat[] = [
  {
    id: '1',
    nom: 'Dupont',
    prenom: 'Jean',
    metier: 'Développeur Full Stack',
    mail: 'jean.dupont@email.com',
    telephone: '0612345678',
    adresse: '123 Rue de la République, 75001 Paris',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    nom: 'Martin',
    prenom: 'Sophie',
    metier: 'Chef de Projet Digital',
    mail: 'sophie.martin@email.com',
    telephone: '0623456789',
    adresse: '45 Avenue des Champs, 69000 Lyon',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: '3',
    nom: 'Bernard',
    prenom: 'Pierre',
    metier: 'Data Analyst',
    mail: 'pierre.bernard@email.com',
    telephone: '0634567890',
    adresse: '78 Boulevard Victor Hugo, 33000 Bordeaux',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

export const mockClients: Client[] = [
  {
    id: '1',
    raisonSociale: 'Tech Solutions SA',
    secteurActivite: 'Technologies de l\'information',
    adresse_ligne1: '100 Boulevard Haussmann',
    code_postal: '75008',
    ville: 'Paris',
    pays: 'France',
    telephone: '0142567890',
    email: 'contact@techsolutions.fr',
    siteWeb: 'https://techsolutions.fr',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    raisonSociale: 'Digital Innovation Corp',
    secteurActivite: 'Conseil en transformation digitale',
    adresse_ligne1: '50 Rue de la Paix',
    code_postal: '69002',
    ville: 'Lyon',
    pays: 'France',
    telephone: '0478901234',
    email: 'rh@digitalinnovation.fr',
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12'),
  },
];

export const mockRdvs: Rdv[] = [
  {
    id: '1',
    candidatId: '1',
    clientId: '1',
    date: new Date('2024-03-20T10:00:00'),
    typeRdv: 'TEAMS',
    statut: 'ENCOURS',
    notes: 'Premier entretien technique',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: '2',
    candidatId: '2',
    clientId: '2',
    date: new Date('2024-03-22T14:00:00'),
    typeRdv: 'PRESENTIEL_CLIENT',
    statut: 'ENCOURS',
    lieu: 'Siège social Lyon',
    createdAt: new Date('2024-03-02'),
    updatedAt: new Date('2024-03-02'),
  },
];

export const mockPostes: PosteClient[] = [
  {
    id: '1',
    clientId: '1',
    nomPoste: 'Développeur Senior React',
    dateCreation: new Date('2024-03-01'),
    dateEcheance: new Date('2024-04-30'),
    statut: 'ENCOURS',
    typePrestation: 'RECRUTEMENT',
    detail: '**Recherche Développeur React Senior**\n\nNous recherchons un développeur React expérimenté pour rejoindre notre équipe.\n\n_Compétences requises:_\n- 5 ans d\'expérience minimum\n- Maîtrise de React et TypeScript\n- Expérience avec les API REST',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: '2',
    clientId: '2',
    nomPoste: 'Chef de Projet Agile',
    dateCreation: new Date('2024-02-15'),
    statut: 'ENCOURS',
    typePrestation: 'FORMATION',
    detail: '**Chef de Projet Agile**\n\nPilotage de projets de transformation digitale.',
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
];

export const mockCommentairesCollaborateur: CommentaireCandidatParCollaborateur[] = [
  {
    id: '1',
    candidatId: '1',
    commentaire: 'Excellent profil technique. Très bonne maîtrise de React et Node.js. Candidat motivé et professionnel.',
    collaborateurNom: 'Marie Consultant',
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-03-05'),
  },
];

export const mockCommentairesClient: CommentaireCandidatParClient[] = [
  {
    id: '1',
    candidatId: '1',
    clientId: '1',
    commentaire: 'Profil intéressant, à revoir pour un second entretien avec l\'équipe technique.',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10'),
  },
];