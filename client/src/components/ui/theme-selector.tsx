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
    name: "Royal Navy",
    description: "Deep navy blue with gold accents",
    primary: "#0A2342",
    accent: "#D5A021",
    background: "#F5F7FA",
    text: "#292F36",
    highlight: "#A68A3F",
    config: {
      primary: "hsl(214 75% 15%)",
      appearance: "light",
      variant: "professional",
      radius: 0.4
    }
  },
  {
    name: "Alpine Emerald",
    description: "Rich emerald green with cream tones",
    primary: "#0F5C3B",
    accent: "#5D987E",
    background: "#F7F6F1",
    text: "#2D2D2A",
    highlight: "#E0DCC5",
    config: {
      primary: "hsl(155 72% 21%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Obsidian Dark",
    description: "Premium dark theme with slate accents",
    primary: "#121212",
    accent: "#8A8D93",
    background: "#1E1E1E",
    text: "#F8F9FA",
    highlight: "#4D97FF",
    config: {
      primary: "hsl(0 0% 7%)",
      appearance: "dark",
      variant: "professional",
      radius: 0.35
    }
  },
  {
    name: "Burgundy Estate",
    description: "Rich burgundy with warm tan accents",
    primary: "#6E1423",
    accent: "#A4957A",
    background: "#F9F6F0",
    text: "#32292F",
    highlight: "#D0B59E",
    config: {
      primary: "hsl(350 68% 25%)",
      appearance: "light",
      variant: "professional",
      radius: 0.3
    }
  },
  {
    name: "Indigo Frost",
    description: "Deep indigo with silver accents",
    primary: "#32407B",
    accent: "#AEB8FE",
    background: "#F6F8FF",
    text: "#28293D",
    highlight: "#D1DCF0",
    config: {
      primary: "hsl(229 43% 34%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Espresso",
    description: "Rich coffee tones with cream finish",
    primary: "#3A2618",
    accent: "#D5BFA9",
    background: "#F9F4F0",
    text: "#2C2824",
    highlight: "#C08552",
    config: {
      primary: "hsl(24 42% 16%)",
      appearance: "light",
      variant: "professional",
      radius: 0.5
    }
  },
  {
    name: "Graphite",
    description: "Clean slate gray with teal accents",
    primary: "#37474F",
    accent: "#4DB6AC",
    background: "#ECEFF1",
    text: "#263238",
    highlight: "#80CBC4",
    config: {
      primary: "hsl(200 18% 26%)",
      appearance: "light",
      variant: "professional",
      radius: 0.4
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {themePresets.map((preset) => (
          <Card 
            key={preset.name}
            className="overflow-hidden cursor-pointer transition-all hover:shadow-lg border-2 hover:border-primary/50"
            onClick={() => applyTheme(preset)}
          >
            <div 
              className="h-28 w-full relative" 
              style={{ backgroundColor: preset.primary }}
            >
              <div className="absolute inset-0 flex">
                <div className="w-1/3 h-full" style={{ backgroundColor: preset.accent }}></div>
                <div className="w-2/3 flex items-center justify-center">
                  {preset.highlight && (
                    <div 
                      className="w-8 h-8 rounded-full shadow-md flex items-center justify-center"
                      style={{ backgroundColor: preset.highlight }}
                    >
                      <div className="w-3 h-3 rounded-full bg-white opacity-75"></div>
                    </div>
                  )}
                </div>
              </div>
              <div 
                className="absolute bottom-0 left-0 right-0 h-6 flex items-center px-3" 
                style={{ backgroundColor: preset.background }}
              >
                <div className="w-full flex justify-between items-center">
                  <div className="h-3 w-16 rounded-sm" style={{ backgroundColor: preset.primary }}></div>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.accent }}></div>
                </div>
              </div>
            </div>

            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-base">{preset.name}</h4>
                {preset.config.appearance === "dark" ? (
                  <div className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Dark</div>
                ) : (
                  <div className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">Light</div>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{preset.description}</p>
              
              <div className="flex mt-3 space-x-2">
                <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: preset.primary }}></div>
                <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: preset.accent }}></div>
                {preset.highlight && (
                  <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: preset.highlight }}></div>
                )}
                <div className="w-6 h-6 rounded-full shadow-sm ml-auto" style={{ backgroundColor: preset.background }}>
                  <div className="h-full w-full rounded-full flex items-center justify-center">
                    <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: preset.text }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {themeMutation.isPending && (
        <div className="mt-4 p-3 bg-primary/10 rounded-md flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-sm font-medium">
            Applying theme...
          </p>
        </div>
      )}
    </div>
  );
}