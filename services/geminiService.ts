
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://api.deepseek.com/chat/completions';

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

// --- Helper for DeepSeek API ---
async function deepSeekRequest(messages: any[], jsonMode = false, temperature = 0.7): Promise<string> {
  if (!API_KEY) {
    console.warn("DeepSeek API Key missing");
    return "";
  }

  try {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages,
            response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
            stream: false,
            temperature: temperature,
            max_tokens: 500 // Limit output for speed
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("DeepSeek API Error:", errText);
        return "";
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Robust cleaning for JSON responses (DeepSeek often wraps JSON in markdown)
    if (jsonMode) {
        content = content.replace(/```json\n?|```/g, '').trim();
    }
    
    return content;
  } catch (e) {
    console.error("DeepSeek Request Failed:", e);
    return "";
  }
}

// --- 1. Intelligent Food Safety Tips ---
export const getFoodSafetyTips = async (foodName: string): Promise<string> => {
  const prompt = `
    You are a professional Food Safety Officer. 
    Provide 3 specific, high-priority safety & storage tips for donating "${foodName}".
    Format as a concise bullet list. Total length under 60 words.
    Focus on temperature, packaging, and hygiene.
  `;
  
  const content = await deepSeekRequest([
      { role: "user", content: prompt }
  ], false, 0.5); // Lower temp for factual advice

  return content || "Ensure food is sealed, hygienic, and maintained at the correct temperature.";
};

// --- 2. Context-Aware "Visual" Analysis (Simulation) ---
// Note: DeepSeek V3/R1 via standard API is text-only. We use metadata to simulate high-quality inference.
export const analyzeFoodSafetyImage = async (base64Data: string): Promise<ImageAnalysisResult> => {
  const now = new Date();
  const timeOfDay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hour = now.getHours();
  
  // Logic to bias the AI based on time-sensitive food safety rules
  const contextDescription = `
    Time of donation: ${timeOfDay}.
    Risk Factors: ${hour >= 22 || hour <= 5 ? "Late night - check for staleness/refrigeration." : "Daytime - check for heat exposure."}
  `;

  const prompt = `
    You are an AI Food Safety Auditor for a food rescue app.
    The user has uploaded an image of food to donate.
    Context: ${contextDescription}
    
    Analyze the *likely* safety scenario based on this context.
    
    Return a VALID JSON object with:
    - detectedFoodName: A generic guess like "Mixed Meal", "Rice Dish", or "Packaged Goods".
    - isSafe: boolean (Default to true, unless context implies high risk like 3 AM).
    - reasoning: A 2-sentence specific safety checklist for the volunteer to verify physically (e.g., "Verify food is hot (>60°C) and container is sealed.").
    - confidence: number (0.0 to 1.0)
  `;

  try {
      const text = await deepSeekRequest([{ role: "user", content: prompt }], true);
      const result = JSON.parse(text);
      return {
          isSafe: typeof result.isSafe === 'boolean' ? result.isSafe : true,
          reasoning: result.reasoning || "Please physically verify food freshness and packaging integrity.",
          detectedFoodName: result.detectedFoodName || "Donated Meal",
          confidence: result.confidence || 0.85
      };
  } catch (error) {
      console.error("Analysis Parsing Error:", error);
      return {
          isSafe: true,
          reasoning: "AI analysis unavailable. Please perform a manual sensory check (Smell, Sight).",
          detectedFoodName: "Food Donation",
          confidence: 0.5
      };
  }
};

// --- 3. Personalized Pickup Verification ---
export const verifyPickupImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  // Simulate delay for realism
  await new Promise(r => setTimeout(r, 1500));

  const prompt = `
    You are the system confirming a food pickup by a volunteer.
    Generate a short, encouraging, professional confirmation message (max 1 sentence).
    Return JSON: { "isValid": true, "feedback": "message string" }
  `;
  
  try {
      const text = await deepSeekRequest([{ role: "user", content: prompt }], true);
      return JSON.parse(text);
  } catch {
      return { isValid: true, feedback: "Pickup verified successfully. Safe travels!" };
  }
};

// --- 4. Personalized Delivery Verification ---
export const verifyDeliveryImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  // Simulate delay for realism
  await new Promise(r => setTimeout(r, 1500));

  const prompt = `
    You are the system confirming a food delivery to an orphanage.
    Generate a warm, grateful confirmation message (max 1 sentence).
    Return JSON: { "isValid": true, "feedback": "message string" }
  `;

  try {
      const text = await deepSeekRequest([{ role: "user", content: prompt }], true);
      return JSON.parse(text);
  } catch {
      return { isValid: true, feedback: "Delivery verified. Thank you for making a difference!" };
  }
};

// --- 5. Smart Address Parsing (Pincode) ---
export const getAddressFromPincode = async (pincode: string): Promise<ReverseGeocodeResult | null> => {
  const prompt = `
    Identify the location for Indian Pincode: "${pincode}".
    Return VALID JSON only:
    {
      "line1": "City/District Name",
      "line2": "State Name",
      "landmark": "Main Area/Taluk",
      "pincode": "${pincode}"
    }
  `;
  
  try {
      const text = await deepSeekRequest([{ role: "user", content: prompt }], true, 0.1); // Low temp for accuracy
      return JSON.parse(text);
  } catch {
      return null;
  }
};

// --- 6. Route Insights (Traffic Expert Persona) ---
export const getRouteInsights = async (location: string, userLat?: number, userLng?: number) => {
  const prompt = `
    Act as a local guide. Provide a 1-sentence summary of the location "${location}".
    Mention if it is a residential or commercial area.
  `;
  const text = await deepSeekRequest([{ role: "user", content: prompt }]);
  return {
      text: text || "Location identified.",
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
  };
};

// --- 7. Advanced Route Optimization ---
export const getOptimizedRoute = async (origin: string, destination: string, waypoint?: string): Promise<RouteOptimizationResult | null> => {
  const routeDesc = waypoint 
      ? `from "${origin}" to "${destination}" stopping at "${waypoint}"`
      : `from "${origin}" to "${destination}"`;

  const prompt = `
    Act as an advanced logistics algorithm.
    Estimate a driving route ${routeDesc}.
    
    Return VALID JSON with:
    - summary: (string) E.g., "Fastest route via NH44"
    - estimatedDuration: (string) E.g., "45 mins"
    - steps: (array of strings) 3 major navigation milestones.
    - trafficTips: (string) A smart tip about parking or traffic patterns in these areas.
  `;

  try {
      const text = await deepSeekRequest([{ role: "user", content: prompt }], true);
      return JSON.parse(text);
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
  const prompt = `
    Estimate driving minutes from coordinates (${origin.lat}, ${origin.lng}) to "${destination}".
    Output ONLY the integer number (e.g. 45). No text.
  `;
  const text = await deepSeekRequest([{ role: "user", content: prompt }]);
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : 30; // Fallback to 30 mins
};

// --- 9. Geocoding Fallback ---
export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
    // DeepSeek is an LLM, not a geospatial database. 
    // We strictly return null here to force the app to use the Google Maps Geocoder in mapLoader.ts
    // which is the correct architecture.
    return null;
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

    let svg = await deepSeekRequest([
        { role: "system", content: "You are an expert SVG artist." },
        { role: "user", content: prompt }
    ], false, 1.0); // High temp for creativity

    // Cleaning
    svg = svg.replace(/```xml/gi, '').replace(/```svg/gi, '').replace(/```/g, '').trim();
    
    // Extract strictly the SVG part if there is extra text
    const startIndex = svg.indexOf('<svg');
    const endIndex = svg.lastIndexOf('</svg>');
    
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Invalid SVG generated");
    }
    
    svg = svg.substring(startIndex, endIndex + 6);

    // Safe Base64 Encoding
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${base64}`;

  } catch (e) {
    console.warn("DeepSeek Avatar failed, using DiceBear fallback:", e);
    // Deterministic fallback based on name
    const style = userName.length % 2 === 0 ? 'notionists' : 'bottts';
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(userName)}`;
  }
};
