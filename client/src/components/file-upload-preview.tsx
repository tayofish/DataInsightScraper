import React from "react";
import { X, FileIcon, ImageIcon, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface FileUploadPreviewProps {
  file: File;
  progress: number;
  onCancel: () => void;
}

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  file,
  progress,
  onCancel
}) => {
  const isImage = file.type.startsWith("image/");
  const imageSrc = isImage ? URL.createObjectURL(file) : null;

  // Clean up object URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2 my-2">
      <div className="flex-shrink-0">
        {isImage ? (
          <div className="relative h-10 w-10 rounded-md overflow-hidden">
            <img 
              src={imageSrc || ""} 
              alt="Upload preview" 
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 flex-shrink-0" 
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      </div>
    </div>
  );
};