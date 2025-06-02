import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, UploadCloud, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Favicon upload form schema
const faviconUploadSchema = z.object({
  favicon: z.instanceof(FileList).refine(
    (files) => files.length > 0,
    { message: "Please select a favicon file" }
  ).refine(
    (files) => files[0]?.size <= 1 * 1024 * 1024, // 1MB max
    { message: "Favicon file must be less than 1MB" }
  ).refine(
    (files) => ["image/png", "image/x-icon", "image/vnd.microsoft.icon"].includes(files[0]?.type),
    { message: "Favicon must be in PNG or ICO format" }
  )
});

type FaviconUploadFormValues = z.infer<typeof faviconUploadSchema>;

export default function FaviconUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form for favicon upload
  const form = useForm<FaviconUploadFormValues>({
    resolver: zodResolver(faviconUploadSchema),
    defaultValues: {
      favicon: undefined
    }
  });

  // Fetch current favicon
  const { data: faviconSetting, isLoading: isLoadingFavicon } = useQuery({
    queryKey: ["/api/app-settings/favicon"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/app-settings/favicon");
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch favicon");
        return res.json();
      } catch (error) {
        console.error("Error fetching favicon:", error);
        return null;
      }
    }
  });

  // Upload favicon mutation
  const uploadFaviconMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/app-settings/favicon", {
        method: "POST",
        body: data,
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload favicon");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings/favicon"] });
      toast({
        title: "Favicon uploaded",
        description: "Your favicon has been updated successfully. It may take a few minutes to appear in browser tabs.",
      });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Clear the preview
      setPreviewUrl(null);
      
      // Update the actual favicon in the document head
      updateDocumentFavicon(data.value);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle file selection for preview
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setPreviewUrl(null);
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle form submission
  const onSubmit = (values: FaviconUploadFormValues) => {
    const formData = new FormData();
    formData.append("favicon", values.favicon[0]);
    uploadFaviconMutation.mutate(formData);
  };

  // Update favicon in document head
  const updateDocumentFavicon = (faviconUrl: string) => {
    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());

    // Add new favicon
    const link = document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = faviconUrl;
    document.getElementsByTagName('head')[0].appendChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="mr-2 h-5 w-5" /> Favicon
        </CardTitle>
        <CardDescription>
          Upload a favicon that will appear in browser tabs and bookmarks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Favicon Display */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Current Favicon</h4>
          <div className="border rounded-md p-4 flex items-center justify-center bg-muted/20 h-20">
            {isLoadingFavicon ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : faviconSetting?.value ? (
              <img 
                src={faviconSetting.value} 
                alt="Current favicon" 
                className="w-8 h-8 object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground flex flex-col items-center">
                <Globe className="h-6 w-6 mb-1 opacity-30" />
                <span className="text-xs">No favicon uploaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Favicon Upload Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="favicon"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Upload New Favicon</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <Input
                        type="file"
                        accept="image/png,.ico,image/x-icon,image/vnd.microsoft.icon"
                        onChange={(e) => {
                          onChange(e.target.files);
                          handleFileChange(e);
                        }}
                        ref={fileInputRef}
                      />
                      
                      {previewUrl && (
                        <div className="border rounded-md p-4 bg-muted/20">
                          <h4 className="font-medium text-sm mb-2">Preview</h4>
                          <div className="flex items-center justify-center h-16">
                            <img 
                              src={previewUrl} 
                              alt="Favicon preview" 
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Recommended: 32x32 PNG or ICO file (max 1MB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={uploadFaviconMutation.isPending}
                className="mt-2"
              >
                {uploadFaviconMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">
                      <UploadCloud className="h-4 w-4" />
                    </span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload Favicon
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Tips Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Favicon Tips</AlertTitle>
          <AlertDescription>
            A favicon should be a simple, recognizable icon that represents your brand. 
            It will appear in browser tabs, bookmarks, and browser history.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}