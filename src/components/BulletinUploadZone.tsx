import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FileWithPreview extends File {
  preview?: string;
  progress?: number;
  status?: 'pending' | 'uploading' | 'analyzing' | 'success' | 'error';
  error?: string;
}

interface BulletinUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing?: boolean;
  maxFiles?: number;
}

export const BulletinUploadZone = ({ 
  onFilesSelected, 
  isProcessing = false,
  maxFiles = 10 
}: BulletinUploadZoneProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
        progress: 0
      })
    );
    
    setFiles(prev => [...prev, ...newFiles]);
    onFilesSelected(newFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles,
    disabled: isProcessing
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const clearAll = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          !isDragActive && "border-border hover:border-primary/50",
          isProcessing && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? "Déposez les fichiers ici" : "Glissez-déposez vos bulletins de salaire"}
            </p>
            <p className="text-xs text-muted-foreground">
              ou cliquez pour sélectionner (PDF uniquement, max {maxFiles} fichiers)
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} fichier(s) sélectionné(s)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isProcessing}
            >
              Tout effacer
            </Button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  
                  {file.status === 'uploading' && (
                    <Progress value={file.progress || 0} className="mt-2 h-1" />
                  )}
                  
                  {file.status === 'analyzing' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">
                        Analyse en cours...
                      </span>
                    </div>
                  )}
                  
                  {file.status === 'success' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Analysé avec succès
                    </p>
                  )}
                  
                  {file.status === 'error' && (
                    <p className="text-xs text-destructive mt-1">
                      ✗ {file.error || 'Erreur lors du traitement'}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={isProcessing}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
