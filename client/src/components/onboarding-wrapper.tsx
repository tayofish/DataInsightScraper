import { useQuery } from "@tanstack/react-query";
import { OnboardingPopup } from "./onboarding-popup";
import { useState, useEffect } from "react";
import type { User } from "@shared/schema";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Get current user data
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ['/api/user']
  });

  useEffect(() => {
    // Show onboarding if user is authenticated but hasn't completed onboarding
    if (user && !user.hasCompletedOnboarding && !isLoading && !isError) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [user, isLoading, isError]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // If user hasn't completed onboarding, show popup and prevent dashboard access
  if (showOnboarding) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Welcome to Promellon!</h1>
            <p className="text-muted-foreground">Please complete your profile setup to continue.</p>
          </div>
        </div>
        <OnboardingPopup 
          isOpen={showOnboarding} 
          onComplete={handleOnboardingComplete} 
        />
      </>
    );
  }

  // Normal app flow for users who have completed onboarding
  return <>{children}</>;
}