import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Building2, Users, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Department, Category } from "@shared/schema";

interface OnboardingPopupProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingPopup({ isOpen, onComplete }: OnboardingPopupProps) {
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [unitSearchQuery, setUnitSearchQuery] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'welcome' | 'email' | 'units' | 'department' | 'summary'>('welcome');
  const { toast } = useToast();

  // Fetch current user to get existing email
  const { data: currentUser } = useQuery<{id: number, email?: string}>({
    queryKey: ['/api/user'],
    enabled: isOpen
  });

  // Initialize email from current user data
  useEffect(() => {
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  // Fetch departments (units)
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isOpen
  });

  // Fetch categories (departments) 
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: isOpen
  });

  // Debug categories loading and force correct department data
  useEffect(() => {
    if (isOpen && categories.length > 0) {
      console.log('ONBOARDING DEBUG - Categories loaded:', categories);
      console.log('ONBOARDING DEBUG - Should show as departments:', categories.map(c => c.name));
    }
    if (categoriesError) {
      console.error('ONBOARDING DEBUG - Error loading categories:', categoriesError);
    }
    if (isOpen && departments.length > 0) {
      console.log('ONBOARDING DEBUG - Departments (units) loaded:', departments);
    }
  }, [categories, categoriesError, departments, isOpen]);

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: { unitIds: number[], departmentId: number, email?: string }) => {
      const response = await fetch('/api/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete onboarding');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome aboard!",
        description: "Your profile has been set up successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Setup failed",
        description: error.message || "Failed to complete setup. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleUnitToggle = (unitId: number) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleComplete = () => {
    if (!email || !validateEmail(email)) {
      toast({
        title: "Valid email required",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    if (selectedUnits.length === 0) {
      toast({
        title: "Unit selection required",
        description: "Please select at least one unit.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedDepartment) {
      toast({
        title: "Department selection required", 
        description: "Please select a department.",
        variant: "destructive"
      });
      return;
    }

    completeOnboardingMutation.mutate({
      unitIds: selectedUnits,
      departmentId: parseInt(selectedDepartment),
      email: email
    });
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Welcome to Promellon!</h3>
              <p className="text-muted-foreground">
                Let's set up your profile to get you started. We need to assign you to your units and department for better collaboration.
              </p>
            </div>
            <Button onClick={() => setCurrentStep('email')} className="w-full">
              Get Started
            </Button>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="mx-auto w-12 h-12 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">Verify Your Email</h3>
              <p className="text-sm text-muted-foreground">
                Please confirm or update your email address for notifications and communication.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email-input">Email Address</Label>
              <Input 
                id="email-input"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={!validateEmail(email) && email ? "border-red-500" : ""}
              />
              {!validateEmail(email) && email && (
                <p className="text-sm text-red-500">Please enter a valid email address</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('welcome')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('units')} 
                disabled={!email || !validateEmail(email)}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'units':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="mx-auto w-12 h-12 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">Select Your Units</h3>
              <p className="text-sm text-muted-foreground">
                Choose the units you'll be working with. You can select multiple units.
              </p>
            </div>

            <div className="space-y-3">
              <Input 
                placeholder="Search units..."
                value={unitSearchQuery}
                onChange={(e) => setUnitSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <ScrollArea className="h-64 w-full">
              <div className="space-y-2">
                {departments
                  .filter(dept => 
                    dept.name.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
                    (dept.description && dept.description.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                  )
                  .map((dept) => (
                  <Card 
                    key={dept.id}
                    className={`cursor-pointer transition-colors ${
                      selectedUnits.includes(dept.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleUnitToggle(dept.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{dept.name}</h4>
                          {dept.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {dept.description}
                            </p>
                          )}
                        </div>
                        {selectedUnits.includes(dept.id) && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('welcome')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('department')} 
                disabled={selectedUnits.length === 0}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'department':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="mx-auto w-12 h-12 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">Select Your Department</h3>
              <p className="text-sm text-muted-foreground">
                Choose your primary department for task assignments and reporting structure.
              </p>
              {categories.length > 0 && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  DEBUG: Showing {categories.length} departments from categories API
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="department-select">Department</Label>
              {categoriesLoading ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Loading departments...</p>
                </div>
              ) : categoriesError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500">Error loading departments. Please try again.</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No departments available. Please contact your administrator.</p>
                </div>
              ) : (
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('units')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('summary')} 
                disabled={!selectedDepartment}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'summary':
        const selectedUnitsData = departments.filter(d => selectedUnits.includes(d.id));
        const selectedDepartmentData = categories.find(c => c.id.toString() === selectedDepartment);

        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto w-12 h-12 text-green-500 mb-3" />
              <h3 className="text-lg font-semibold mb-2">Review Your Setup</h3>
              <p className="text-sm text-muted-foreground">
                Please review your selections below.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Selected Units</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUnitsData.map((unit) => (
                    <Badge key={unit.id} variant="secondary">
                      {unit.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Primary Department</Label>
                <div className="mt-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <div 
                      className="w-2 h-2 rounded-full mr-2" 
                      style={{ backgroundColor: selectedDepartmentData?.color }}
                    />
                    {selectedDepartmentData?.name}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('department')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleComplete}
                disabled={completeOnboardingMutation.isPending}
                className="flex-1"
              >
                {completeOnboardingMutation.isPending ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Welcome Setup</DialogTitle>
        </DialogHeader>
        {getStepContent()}
      </DialogContent>
    </Dialog>
  );
}