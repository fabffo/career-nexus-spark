import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, FileText, Eye } from 'lucide-react';
import { useRef } from 'react';

interface FileUploadFieldProps {
  label: string;
  accept?: string;
  currentFileUrl?: string;
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  disabled?: boolean;
}

export const FileUploadField = ({
  label,
  accept = '.pdf,.doc,.docx',
  currentFileUrl,
  onFileSelect,
  onFileRemove,
  disabled = false,
}: FileUploadFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleViewFile = () => {
    if (currentFileUrl) {
      window.open(currentFileUrl, '_blank');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        
        {currentFileUrl ? (
          <>
            <div className="flex-1 flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                Fichier téléchargé
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleViewFile}
              disabled={disabled}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onFileRemove}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleButtonClick}
            disabled={disabled}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Télécharger {label}
          </Button>
        )}
      </div>
    </div>
  );
};