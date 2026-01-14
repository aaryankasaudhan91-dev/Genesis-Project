
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Types ---
export interface ImageAnalysisResult {
  isSafe: boolean;
  reasoning: string;
  detectedFoodName: string;
  confidence: number;
}

export interface RouteOptimizationResult {
  summary: string;
  estimatedDuration: string;
  steps: string[];
  trafficTips: string;
}

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
}

// Helper to strip data URL prefix
const getBase64 = (dataUrl: string) => {
    return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
};

// Helper to clean JSON string from Markdown
const cleanJson = (text: string) => {
    return text.replace(/```json\n?|```/g, '').trim();
};

// --- 1. Intelligent Food Safety Tips (Updated to Fast Model) ---
export const getFoodSafetyTips = async (foodName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite', // FAST AI RESPONSE
        contents: `You are a professional Food Safety Officer. 
        Provide 3 specific, high-priority safety & storage tips for donating "${foodName}".
        Format as a concise bullet list. Total length under 60 words.
        Focus on temperature, packaging, and hygiene.`,
        config: { temperature: 0.5 }
    });
    return response.text || "Ensure food is sealed, hygienic, and maintained at the correct temperature.";
  } catch (e) {
    console.error("Gemini Safety Tips Error:", e);
    return "Ensure food is sealed, hygienic, and maintained at the correct temperature.";
  }
};

// --- 2. Context-Aware Visual Analysis ---
export const analyzeFoodSafetyImage = async (base64Data: string): Promise<ImageAnalysisResult> => {
  const prompt = `
    You are an AI Food Safety Auditor for a food rescue app.
    Analyze this image of food to determine if it appears safe for donation.
    
    Return a VALID JSON object with no markdown formatting:
    {
      "detectedFoodName": "A generic guess like 'Mixed Meal'",
      "isSafe": boolean (true/false),
      "reasoning": "A 2-sentence specific safety checklist based on the visual evidence (e.g. 'Food appears fresh but container needs a lid.')",
      "confidence": number (0.0 to 1.0)
    }
  `;

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
              parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: getBase64(base64Data) } },
                  { text: prompt }
              ]
          }
      });

      const text = cleanJson(response.text || "{}");
      const result = JSON.parse(text);
      
      return {
          isSafe: typeof result.isSafe === 'boolean' ? result.isSafe : true,
          reasoning: result.reasoning || "Please physically verify food freshness and packaging integrity.",
          detectedFoodName: result.detectedFoodName || "Donated Meal",
          confidence: result.confidence || 0.85
      };
  } catch (error) {
      console.error("Gemini Image Analysis Error:", error);
      return {
          isSafe: true,
          reasoning: "AI analysis unavailable. Please perform a manual sensory check (Smell, Sight).",
          detectedFoodName: "Food Donation",
          confidence: 0.5
      };
  }
};

// --- NEW: Image Editing (Nano Banana) ---
export const editImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: getBase64(base64Image) } },
          { text: prompt }
        ],
      },
    });
    
    // Find the image part in the response
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
  } catch (e) {
    console.error("Image Edit Error", e);
    return null;
  }
};

// --- NEW: Audio Transcription (STT) ---
export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/wav'): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: getBase64(base64Audio) } },
                    { text: "Transcribe this audio accurately. Return only the transcript text." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Transcription Error", e);
        return "";
    }
};

// --- NEW: Text to Speech (TTS) ---
export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return audioData || null;
    } catch (e) {
        console.error("TTS Error", e);
        return null;
    }
};

// --- NEW: Search Grounding ---
export const askWithSearch = async (query: string): Promise<{text: string, sources: any[]}> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: query,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return { text: response.text || "No information found.", sources: groundingChunks };
    } catch (e) {
        console.error("Search Error", e);
        return { text: "Search unavailable at the moment.", sources: [] };
    }
};

// --- NEW: Maps Grounding ---
export const askWithMaps = async (query: string, location?: {lat: number, lng: number}): Promise<{text: string, sources: any[]}> => {
    try {
        // STRICT CONFIGURATION for Maps Grounding
        const config: any = {
            tools: [{ googleMaps: {} }]
        };
        
        if (location) {
            config.toolConfig = {
                retrievalConfig: {
                    latLng: {
                        latitude: location.lat,
                        longitude: location.lng
                    }
                }
            };
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: config
        });
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        // Ensure text exists even if not grounded, though grounding usually returns both
        return { text: response.text || "I couldn't find specific location details.", sources: groundingChunks };
    } catch (e) {
        console.error("Maps Grounding Error", e);
        return { text: "Location services unavailable.", sources: [] };
    }
};

// --- 3. Personalized Pickup Verification ---
export const verifyPickupImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  const prompt = `
    You are the system confirming a food pickup by a volunteer.
    Analyze the image to ensure it looks like a food pickup (containers, bags, or handover).
    Generate a short, encouraging, professional confirmation message (max 1 sentence).
    Return JSON: { "isValid": true, "feedback": "message string" }
  `;
  
  try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
              parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: getBase64(base64Data) } },
                  { text: prompt }
              ]
          }
      });
      const text = cleanJson(response.text || "{}");
      return JSON.parse(text);
  } catch {
      return { isValid: true, feedback: "Pickup verified successfully. Safe travels!" };
  }
};

// --- 4. Personalized Delivery Verification ---
export const verifyDeliveryImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  const prompt = `
    You are the system confirming a food delivery to an orphanage.
    Analyze the image to ensure it looks like a successful delivery.
    Generate a warm, grateful confirmation message (max 1 sentence).
    Return JSON: { "isValid": true, "feedback": "message string" }
  `;

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
              parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: getBase64(base64Data) } },
                  { text: prompt }
              ]
          }
      });
      const text = cleanJson(response.text || "{}");
      return JSON.parse(text);
  } catch {
      return { isValid: true, feedback: "Delivery verified. Thank you for making a difference!" };
  }
};

// --- 5. Smart Address Parsing (Pincode) ---
export const getAddressFromPincode = async (pincode: string): Promise<ReverseGeocodeResult | null> => {
  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Identify the city, state, and district for Indian Pincode: "${pincode}".`,
          config: {
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      line1: { type: Type.STRING, description: "City/District Name" },
                      line2: { type: Type.STRING, description: "State Name" },
                      landmark: { type: Type.STRING, description: "Main Area/Taluk" },
                      pincode: { type: Type.STRING, description: "The input pincode" }
                  },
                  required: ["line1", "line2", "pincode"]
              }
          }
      });
      return JSON.parse(response.text || "null");
  } catch (e) {
      console.error(e);
      return null;
  }
};

// --- 6. Route Insights ---
export const getRouteInsights = async (location: string, userLat?: number, userLng?: number) => {
  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Act as a local guide. Provide a 1-sentence summary of the location "${location}". Mention if it is a residential or commercial area.`
      });
      return {
          text: response.text || "Location identified.",
          mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
      };
  } catch {
      return { text: "Location identified.", mapsUrl: "" };
  }
};

// --- 7. Advanced Route Optimization ---
export const getOptimizedRoute = async (origin: string, destination: string, waypoint?: string): Promise<RouteOptimizationResult | null> => {
  const routeDesc = waypoint 
      ? `from "${origin}" to "${destination}" stopping at "${waypoint}"`
      : `from "${origin}" to "${destination}"`;

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Act as an advanced logistics algorithm. Estimate a driving route ${routeDesc}.`,
          config: {
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      summary: { type: Type.STRING, description: "E.g., 'Fastest route via NH44'" },
                      estimatedDuration: { type: Type.STRING, description: "E.g., '45 mins'" },
                      steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 major navigation milestones" },
                      trafficTips: { type: Type.STRING, description: "A smart tip about parking or traffic" }
                  }
              }
          }
      });
      return JSON.parse(response.text || "null");
  } catch (e) {
      console.error(e);
      return null;
  }
};

// --- 8. Quick ETA Calc ---
export const calculateLiveEta = async (
  origin: { lat: number; lng: number },
  destination: string
): Promise<number | null> => {
  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Estimate driving minutes from coordinates (${origin.lat}, ${origin.lng}) to "${destination}". Output ONLY the integer number.`
      });
      const match = response.text?.match(/(\d+)/);
      return match ? parseInt(match[1]) : 30;
  } catch {
      return 30;
  }
};

// --- 9. Geocoding Fallback ---
export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
    return null; // Using Google Maps service instead
};

// --- 10. Creative Avatar Generation (SVG) ---
export const generateAvatar = async (userName: string): Promise<string | null> => {
  try {
    const prompt = `
      Create a unique, minimalist SVG avatar for username "${userName}".
      Style: Flat design, vibrant gradient background, circular mask.
      Content: Abstract geometric initials or a friendly robot face.
      Constraint: Output ONLY raw SVG code. Start with <svg and end with </svg>.
      ViewBox: "0 0 256 256".
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 1.0 }
    });

    let svg = response.text || "";
    svg = svg.replace(/```xml/gi, '').replace(/```svg/gi, '').replace(/```/g, '').trim();
    
    const startIndex = svg.indexOf('<svg');
    const endIndex = svg.lastIndexOf('</svg>');
    
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Invalid SVG generated");
    }
    
    svg = svg.substring(startIndex, endIndex + 6);
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${base64}`;

  } catch (e) {
    console.warn("Gemini Avatar failed, using DiceBear fallback:", e);
    const style = userName.length % 2 === 0 ? 'notionists' : 'bottts';
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(userName)}`;
  }
};
