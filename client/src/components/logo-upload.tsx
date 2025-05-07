import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Logo upload form schema
const logoUploadSchema = z.object({
  logo: z.instanceof(FileList).refine(
    (files) => files.length > 0,
    { message: "Please select a logo file" }
  ).refine(
    (files) => files[0]?.size <= 10 * 1024 * 1024, // 10MB max
    { message: "Logo file must be less than 10MB" }
  ).refine(
    (files) => ["image/jpeg", "image/png", "image/svg+xml"].includes(files[0]?.type),
    { message: "Logo must be in JPEG, PNG, or SVG format" }
  )
});

type LogoUploadFormValues = z.infer<typeof logoUploadSchema>;

export default function LogoUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form for logo upload
  const form = useForm<LogoUploadFormValues>({
    resolver: zodResolver(logoUploadSchema),
    defaultValues: {
      logo: undefined
    }
  });

  // Fetch current logo
  const { data: logoSetting, isLoading: isLoadingLogo } = useQuery({
    queryKey: ["/api/app-settings/logo"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/app-settings/logo");
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch logo");
        return res.json();
      } catch (error) {
        console.error("Error fetching logo:", error);
        return null;
      }
    }
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/app-settings/logo", {
        method: "POST",
        body: data,
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload logo");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings/logo"] });
      toast({
        title: "Logo uploaded",
        description: "Your company logo has been updated successfully.",
      });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Clear the preview
      setPreviewUrl(null);
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
  const onSubmit = (values: LogoUploadFormValues) => {
    const formData = new FormData();
    formData.append("logo", values.logo[0]);
    uploadLogoMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Image className="mr-2 h-5 w-5" /> Company Logo
        </CardTitle>
        <CardDescription>
          Upload your organization's logo to display throughout the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Logo Display */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Current Logo</h4>
          <div className="border rounded-md p-4 flex items-center justify-center bg-muted/20 h-40">
            {isLoadingLogo ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : logoSetting?.value ? (
              <img 
                src={logoSetting.value} 
                alt="Company logo" 
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground flex flex-col items-center">
                <Image className="h-10 w-10 mb-2 opacity-30" />
                <span>No logo uploaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Logo Upload Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="logo"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Upload New Logo</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/svg+xml"
                        onChange={(e) => {
                          onChange(e.target.files);
                          handleFileChange(e);
                        }}
                        ref={fileInputRef}
                      />
                      
                      {previewUrl && (
                        <div className="border rounded-md p-4 bg-muted/20">
                          <h4 className="font-medium text-sm mb-2">Preview</h4>
                          <div className="flex items-center justify-center h-32">
                            <img 
                              src={previewUrl} 
                              alt="Logo preview" 
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Recommended: PNG or SVG with transparent background (max 10MB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={uploadLogoMutation.isPending}
                className="mt-2"
              >
                {uploadLogoMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">
                      <UploadCloud className="h-4 w-4" />
                    </span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload Logo
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Tips Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Logo Tips</AlertTitle>
          <AlertDescription>
            Use a high-quality image with a transparent background for best results.
            The logo will be displayed in the application header and reports.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}