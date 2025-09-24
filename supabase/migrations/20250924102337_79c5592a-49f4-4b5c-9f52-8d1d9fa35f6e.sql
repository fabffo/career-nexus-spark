-- Make the candidats-files bucket public to allow file access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'candidats-files';