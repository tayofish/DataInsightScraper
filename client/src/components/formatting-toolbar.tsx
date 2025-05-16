import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Code,
  Link2,
  Paperclip,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FormattingToolbarProps {
  onFormatClick: (format: string) => void;
  onFileUploadClick: () => void;
  onImageUploadClick: () => void;
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormatClick,
  onFileUploadClick,
  onImageUploadClick
}) => {
  // Prevent buttons from submitting forms they're in
  const handleButtonClick = (e: React.MouseEvent, format: string) => {
    e.preventDefault(); // Prevent form submission
    onFormatClick(format);
  };
  
  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    onFileUploadClick();
  };
  
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    onImageUploadClick();
  };
  
  return (
    <div className="flex items-center gap-1 py-1 px-1 bg-muted/50 rounded-md mb-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => handleButtonClick(e, "bold")}
              type="button" // Explicitly set type to button to prevent form submission
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Bold</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => handleButtonClick(e, "italic")}
              type="button"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Italic</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => handleButtonClick(e, "underline")}
              type="button"
            >
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Underline</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => handleButtonClick(e, "code")}
              type="button"
            >
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Code</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => handleButtonClick(e, "link")}
              type="button"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Link</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="border-r border-border h-5 mx-1" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleFileClick}
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Attach File</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleImageClick}
              type="button"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Upload Image</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};