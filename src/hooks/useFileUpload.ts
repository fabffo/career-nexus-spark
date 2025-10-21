import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File, bucket: string = 'candidats-files') => {
    try {
      setIsUploading(true);
      
      const fileExt = file.name.split('.').pop();
      // Sanitize filename: remove spaces and special characters
      const sanitizedName = file.name
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .substring(0, 100); // Limit length
      const timestamp = Date.now();
      const fileName = `${timestamp}_${sanitizedName}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Pour les buckets publics, retourner l'URL publique
      if (bucket === 'candidats-files') {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        return publicUrl;
      }
      
      // Pour les buckets privés, retourner le chemin du fichier
      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors du téléchargement du fichier',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (url: string) => {
    try {
      const path = url.split('/').slice(-2).join('/');
      const { error } = await supabase.storage
        .from('candidats-files')
        .remove([path]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la suppression du fichier',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return { uploadFile, deleteFile, isUploading };
};