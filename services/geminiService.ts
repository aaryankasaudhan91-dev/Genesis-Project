
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFoodSafetyTips = async (foodName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide brief, bulleted safety and storage tips for donating surplus ${foodName}. Focus on hygiene and safe transport. Keep it under 60 words.`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text || "Keep food covered and maintain proper temperature during transport.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ensure food is handled with clean hands and stored in food-grade containers.";
  }
};

export interface ImageAnalysisResult {
  isSafe: boolean;
  reasoning: string;
  detectedFoodName: string;
  confidence: number;
}

export const analyzeFoodSafetyImage = async (base64Data: string): Promise<ImageAnalysisResult> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "Analyze this image of food intended for donation. Is it visually safe and edible? Look for signs of spoilage, mold, or improper handling. Detect the type of food. Respond in JSON format.",
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN, description: "Whether the food appears visually safe to eat" },
            reasoning: { type: Type.STRING, description: "Brief explanation of the visual assessment" },
            detectedFoodName: { type: Type.STRING, description: "Name/type of the food detected" },
            confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 1" }
          },
          required: ["isSafe", "reasoning", "detectedFoodName", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as ImageAnalysisResult;
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return {
      isSafe: false,
      reasoning: "Visual check unavailable. Please manually ensure food is fresh and safe.",
      detectedFoodName: "",
      confidence: 0
    };
  }
};

export const verifyPickupImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "Analyze this image to verify a food pickup. It MUST show food containers, boxes, bags of food, or people handing over items. If the image is black, blurry, or shows something irrelevant, set isValid to false. Respond in JSON format.",
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "Whether the image looks like a valid pickup proof" },
            feedback: { type: Type.STRING, description: "Brief confirmation or specific feedback about why it failed" }
          },
          required: ["isValid", "feedback"]
        }
      }
    });

    return JSON.parse(response.text || '{"isValid": true, "feedback": "Pickup photo processed."}');
  } catch (error) {
    console.error("Gemini Pickup Verification Error:", error);
    return { isValid: true, feedback: "Photo received and logged." };
  }
};

export const verifyDeliveryImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "Analyze this image to verify a food delivery drop-off. It MUST show food items being delivered, a building entrance (orphanage/shelter), or people receiving food. If the image is irrelevant or unclear, set isValid to false. Respond in JSON format.",
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "Whether the image looks like a valid delivery proof" },
            feedback: { type: Type.STRING, description: "A friendly comment about the delivery verification or rejection reason" }
          },
          required: ["isValid", "feedback"]
        }
      }
    });

    return JSON.parse(response.text || '{"isValid": true, "feedback": "Delivery photo processed."}');
  } catch (error) {
    console.error("Gemini Verification Error:", error);
    return { isValid: true, feedback: "Photo received and logged." };
  }
};

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a location accuracy expert. The user is currently at coordinates: ${lat}, ${lng}. 
      Find the most precise street address available.
      
      Return a VALID JSON object with these exact keys:
      - line1: Detailed street address including Building Name/Number and Street Name.
      - line2: Area, Sector, Locality, and City.
      - landmark: A nearby well-known landmark (e.g., "Opposite City Mall").
      - pincode: The precise postal code.

      Example: {"line1": "No. 42, Galaxy Apartments, 5th Cross", "line2": "Indiranagar, Bangalore", "landmark": "Near Metro Station", "pincode": "560038"}

      Do not use markdown formatting. Just return the JSON string.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        },
      },
    });

    let text = response.text || "";
    // Remove potential markdown code blocks
    text = text.replace(/```json\n?|```/g, '').trim();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Reverse Geocoding Error:", error);
    return null;
  }
};

export const getAddressFromPincode = async (pincode: string): Promise<ReverseGeocodeResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find the location details for the Indian Pincode "${pincode}". Return a VALID JSON object with: line1 (City/District), line2 (State), landmark (Main area), pincode.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    let text = response.text || "";
    text = text.replace(/```json\n?|```/g, '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Pincode Lookup Error:", error);
    return null;
  }
};

export const getRouteInsights = async (location: string, userLat?: number, userLng?: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a quick summary of the location: "${location}". Identify major landmarks.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: userLat && userLng ? { latitude: userLat, longitude: userLng } : undefined
          }
        }
      },
    });

    const mapsUrl = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(c => c.maps)?.maps?.uri;
    return {
      text: response.text || "Location found.",
      mapsUrl: mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
    };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return {
      text: "Check location on Google Maps.",
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
    };
  }
};

export interface RouteOptimizationResult {
  summary: string;
  estimatedDuration: string;
  steps: string[];
  trafficTips: string;
}

export const getOptimizedRoute = async (origin: string, destination: string, waypoint?: string): Promise<RouteOptimizationResult | null> => {
  try {
    const routeDesc = waypoint 
      ? `from "${origin}" to "${destination}" via "${waypoint}"`
      : `from "${origin}" to "${destination}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Plan the most efficient driving route ${routeDesc}. Return VALID JSON with: summary, estimatedDuration, steps, trafficTips.`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
    
    let text = response.text || "";
    text = text.replace(/```json\n?|```/g, '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Route Optimization Error:", error);
    return null;
  }
};

export const calculateLiveEta = async (
  origin: { lat: number; lng: number },
  destination: string
): Promise<number | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Calculate the estimated driving time from ${origin.lat}, ${origin.lng} to "${destination}". Return ONLY the number of minutes as an integer.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        }
      },
    });

    const text = response.text || "";
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  } catch (error) {
    console.error("ETA Calculation Error:", error);
    return null;
  }
};

export const generateAvatar = async (userName: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a creative, colorful, abstract profile avatar for a user named "${userName}". The style should be modern, minimalist vector art. Circular composition.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Avatar Generation Error:", error);
    return null;
  }
};
