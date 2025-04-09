import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

// Define theme preset interfaces
interface ThemePreset {
  name: string;
  description: string;
  primary: string;
  accent: string;
  background: string;
  text: string;
  highlight?: string;
  config: {
    primary: string;
    appearance: "light" | "dark" | "system";
    variant: "professional" | "tint" | "vibrant";
    radius: number;
  };
}

// Define all the theme presets with their colors
const themePresets: ThemePreset[] = [
  {
    name: "Classic Light",
    description: "Default purple theme with light background",
    primary: "#7B61FF",
    accent: "#B39DFF",
    background: "#F9F9FF",
    text: "#1C1C1E",
    config: {
      primary: "hsl(250 46% 57%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Midnight Dark",
    description: "Dark theme with blue accents",
    primary: "#1E1E2F",
    accent: "#5A55FF",
    background: "#121217",
    text: "#E1E1E6",
    highlight: "#00D1FF",
    config: {
      primary: "hsl(240 24% 15%)",
      appearance: "dark",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Neo Mint",
    description: "Fresh mint green theme",
    primary: "#3EB489",
    accent: "#8FFFC1",
    background: "#F0FFFA",
    text: "#1E2A2E",
    highlight: "#1C9E89",
    config: {
      primary: "hsl(153 48% 47%)",
      appearance: "light",
      variant: "vibrant",
      radius: 0.75
    }
  },
  {
    name: "Sunset Sorbet",
    description: "Warm red and orange theme",
    primary: "#FF6B6B",
    accent: "#FFD93D",
    background: "#FFF8F2",
    text: "#322F2F",
    highlight: "#FFA987",
    config: {
      primary: "hsl(0 100% 71%)",
      appearance: "light",
      variant: "vibrant",
      radius: 1
    }
  },
  {
    name: "Cyber Blue",
    description: "Bright blue with light background",
    primary: "#00A6FB",
    accent: "#0582CA",
    background: "#F3F9FF",
    text: "#0B132B",
    highlight: "#FF595E",
    config: {
      primary: "hsl(203 100% 49%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Charcoal & Gold",
    description: "Elegant dark theme with gold accents",
    primary: "#1F1F1F",
    accent: "#FFD700",
    background: "#F4F2EC",
    text: "#2C2C2C",
    highlight: "#EBCB8B",
    config: {
      primary: "hsl(0 0% 12%)",
      appearance: "light",
      variant: "professional",
      radius: 0.25
    }
  },
  {
    name: "Blush Rose",
    description: "Soft pink theme with light background",
    primary: "#EFA5B4",
    accent: "#FADADD",
    background: "#FFF6F9",
    text: "#4A4A4A",
    highlight: "#D67A93",
    config: {
      primary: "hsl(348 68% 79%)",
      appearance: "light",
      variant: "tint",
      radius: 1
    }
  },
  {
    name: "Ocean Breeze",
    description: "Refreshing blue theme",
    primary: "#1CA9C9",
    accent: "#A1EAFB",
    background: "#E7F9FF",
    text: "#0B2C3F",
    highlight: "#17BEBB",
    config: {
      primary: "hsl(193 72% 45%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  }
];

export function ThemeSelector() {
  const { toast } = useToast();

  // Mutation to update the theme
  const themeMutation = useMutation({
    mutationFn: async (themeConfig: ThemePreset['config']) => {
      const res = await apiRequest("POST", "/api/theme/update", themeConfig);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Theme Updated",
        description: "Your theme has been updated. Refresh the page to see all changes.",
      });
      
      // Reload the page after a short delay to apply the new theme
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update theme.",
        variant: "destructive",
      });
    },
  });

  // Function to apply a theme preset
  const applyTheme = (preset: ThemePreset) => {
    themeMutation.mutate(preset.config);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-3">Theme Presets</h3>
      <p className="text-sm text-gray-500 mb-6">
        Choose a theme preset to customize the application's appearance. Click on a theme to apply it.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {themePresets.map((preset) => (
          <Card 
            key={preset.name}
            className="overflow-hidden cursor-pointer transition-all hover:shadow-md"
            onClick={() => applyTheme(preset)}
          >
            <div 
              className="h-24 w-full" 
              style={{ backgroundColor: preset.primary }}
            >
              <div className="flex h-full">
                <div className="w-1/4" style={{ backgroundColor: preset.accent }}></div>
                <div className="w-1/4 flex items-end justify-end p-2">
                  {preset.highlight && (
                    <div 
                      className="w-6 h-6 rounded-full" 
                      style={{ backgroundColor: preset.highlight }}
                    ></div>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="pt-4">
              <h4 className="font-medium text-base">{preset.name}</h4>
              <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
              
              <div className="flex mt-3 space-x-2">
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.primary }}></div>
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.accent }}></div>
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.background }}></div>
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.text }}></div>
                {preset.highlight && (
                  <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.highlight }}></div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {themeMutation.isPending && (
        <div className="mt-4 p-2 bg-primary/10 rounded-md">
          <p className="text-sm text-center">
            Applying theme...
          </p>
        </div>
      )}
    </div>
  );
}