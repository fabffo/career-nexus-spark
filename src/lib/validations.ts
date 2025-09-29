import { z } from 'zod';

// Password validation schema
export const passwordSchema = z.string()
  .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  .max(100, { message: "Le mot de passe ne doit pas dépasser 100 caractères" })
  .regex(/[A-Z]/, { message: "Le mot de passe doit contenir au moins une majuscule" })
  .regex(/[a-z]/, { message: "Le mot de passe doit contenir au moins une minuscule" })
  .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre" });

// Email validation schema
export const emailSchema = z.string()
  .trim()
  .email({ message: "Adresse email invalide" })
  .max(255, { message: "L'email ne doit pas dépasser 255 caractères" });

// Phone validation schema
export const phoneSchema = z.string()
  .trim()
  .regex(/^(\+33|0)[1-9](\d{8})$/, { 
    message: "Numéro de téléphone invalide (format: +33 ou 0 suivi de 9 chiffres)" 
  })
  .optional();

// Name validation schema
export const nameSchema = z.string()
  .trim()
  .min(1, { message: "Ce champ est requis" })
  .max(100, { message: "Ne doit pas dépasser 100 caractères" })
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, { 
    message: "Ne doit contenir que des lettres, espaces, apostrophes et tirets" 
  });

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: "Le fichier ne doit pas dépasser 10MB"
    })
    .refine((file) => {
      const allowedTypes = ['application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      return allowedTypes.includes(file.type);
    }, {
      message: "Format de fichier non autorisé (PDF, DOC, DOCX uniquement)"
    })
});

// Auth form schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Le mot de passe est requis" })
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

// Candidat form schema
export const candidatSchema = z.object({
  nom: nameSchema,
  prenom: nameSchema,
  email: emailSchema,
  telephone: phoneSchema,
  metier: z.string().trim().max(100).optional(),
  adresse: z.string().trim().max(500).optional(),
  cv_url: z.string().url().optional().or(z.literal('')),
  recommandation_url: z.string().url().optional().or(z.literal(''))
});

// Client form schema
export const clientSchema = z.object({
  raison_sociale: z.string()
    .trim()
    .min(1, { message: "La raison sociale est requise" })
    .max(200, { message: "La raison sociale ne doit pas dépasser 200 caractères" }),
  secteur_activite: z.string().trim().max(100).optional(),
  adresse: z.string().trim().max(500).optional(),
  telephone: phoneSchema,
  email: emailSchema,
  site_web: z.string().url({ message: "URL invalide" }).optional().or(z.literal(''))
});

// RDV form schema
export const rdvSchema = z.object({
  candidat_id: z.string().uuid({ message: "Candidat invalide" }),
  client_id: z.string().uuid({ message: "Client invalide" }).optional(),
  poste_id: z.string().uuid({ message: "Poste invalide" }).optional(),
  date: z.string().refine((date) => {
    const rdvDate = new Date(date);
    const now = new Date();
    return rdvDate > now;
  }, { message: "La date du RDV doit être dans le futur" }),
  type_rdv: z.enum(['TEAMS', 'PRESENTIEL_CLIENT', 'TELEPHONE']),
  statut: z.enum(['ENCOURS', 'REALISE', 'TERMINE', 'ANNULE']),
  lieu: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional()
});

// Poste form schema
export const posteSchema = z.object({
  titre: z.string()
    .trim()
    .min(1, { message: "Le titre est requis" })
    .max(200, { message: "Le titre ne doit pas dépasser 200 caractères" }),
  client_id: z.string().uuid({ message: "Client invalide" }).optional(),
  description: z.string().trim().max(5000).optional(),
  type_contrat: z.string().trim().max(50).optional(),
  localisation: z.string().trim().max(200).optional(),
  salaire_min: z.number().positive().optional(),
  salaire_max: z.number().positive().optional(),
  competences: z.array(z.string().trim().max(50)).optional(),
  statut: z.enum(['OUVERT', 'FERME', 'POURVU']).optional()
}).refine((data) => {
  if (data.salaire_min && data.salaire_max) {
    return data.salaire_min <= data.salaire_max;
  }
  return true;
}, { 
  message: "Le salaire minimum doit être inférieur au salaire maximum",
  path: ["salaire_max"]
});

// Salarié form schema
export const salarieSchema = z.object({
  nom: nameSchema,
  prenom: nameSchema,
  email: emailSchema,
  telephone: phoneSchema,
  fonction: z.string().trim().max(100).optional(),
  metier: z.string().trim().max(100).optional(),
  role: z.enum(['RECRUTEUR', 'PRESTATAIRE']).optional()
});

// Prestataire form schema
export const prestataireSchema = z.object({
  nom: nameSchema,
  prenom: nameSchema,
  email: emailSchema,
  telephone: phoneSchema,
  cv_url: z.string().url().optional().or(z.literal('')),
  recommandation_url: z.string().url().optional().or(z.literal(''))
});

// Contrat form schema
export const contratSchema = z.object({
  type: z.enum(['SERVICE', 'FOURNITURE']),
  statut: z.enum(['BROUILLON', 'ACTIF', 'TERMINE', 'ANNULE']),
  date_debut: z.string().refine((date) => {
    return !isNaN(Date.parse(date));
  }, { message: "Date invalide" }),
  date_fin: z.string().optional().refine((date) => {
    if (!date) return true;
    return !isNaN(Date.parse(date));
  }, { message: "Date invalide" }),
  montant: z.number().positive({ message: "Le montant doit être positif" }).optional(),
  description: z.string().trim().max(2000).optional(),
  client_id: z.string().uuid().optional(),
  prestataire_id: z.string().uuid().optional(),
  fournisseur_general_id: z.string().uuid().optional(),
  fournisseur_services_id: z.string().uuid().optional()
}).refine((data) => {
  if (data.date_fin) {
    const dateDebut = new Date(data.date_debut);
    const dateFin = new Date(data.date_fin);
    return dateFin >= dateDebut;
  }
  return true;
}, {
  message: "La date de fin doit être après la date de début",
  path: ["date_fin"]
});

// Utility function for sanitizing HTML input
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}

// Utility function for validating and encoding URL parameters
export function encodeUrlParameter(param: string): string {
  // Remove any potentially dangerous characters
  const sanitized = param.replace(/[<>'"]/g, '');
  return encodeURIComponent(sanitized);
}