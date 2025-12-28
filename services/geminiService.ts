import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Place, ItineraryItem } from '../types';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const PLACE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      category: { type: Type.STRING, enum: ['attraction', 'food', 'hotel', 'landmark', 'other'] },
      rating: { type: Type.NUMBER },
      lat: { type: Type.NUMBER },
      lng: { type: Type.NUMBER },
      address: { type: Type.STRING },
    },
    required: ['name', 'category', 'lat', 'lng', 'description'],
  }
};

export const searchPlacesWithGemini = async (query: string, cityContext: string): Promise<Place[]> => {
  try {
    const prompt = `
      You are a travel guide API. 
      The user is searching for: "${query}" in or near the city of "${cityContext}".
      Return a list of 5 to 10 real places that match the query.
      Provide accurate coordinates (latitude and longitude) for each place.
      Categories should be one of: attraction, food, hotel, landmark, other.
      Descriptions should be short and catchy (max 150 chars).
      Rating should be between 3.5 and 5.0.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: PLACE_SCHEMA,
        temperature: 0.3, // Lower temperature for more factual coordinate data
      }
    });

    const rawData = JSON.parse(response.text || '[]');
    
    // Enrich with IDs
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `gemini-${Date.now()}-${index}`,
    }));

  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw new Error("Failed to fetch places. Please try again.");
  }
};

export const suggestCityCenter = async (city: string): Promise<[number, number]> => {
   try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Return only a JSON object with 'lat' and 'lng' properties (numbers) for the center of the city: ${city}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          }
        }
      }
    });
    
    const data = JSON.parse(response.text || '{}');
    if (data.lat && data.lng) {
      return [data.lat, data.lng];
    }
    return [48.8566, 2.3522]; // Default to Paris if fail
   } catch (e) {
     return [48.8566, 2.3522];
   }
};

export const optimizeItineraryOrder = async (items: ItineraryItem[]): Promise<string[]> => {
  if (items.length < 3) return items.map(i => i.id);

  try {
    const prompt = `
      I have a list of places to visit today. Please reorder them to create the most efficient travel route (shortest total distance).
      Start with the first place in the list provided below: "${items[0].name}" (Keep this as the start).
      
      Places:
      ${items.map(i => `- ID: ${i.id}, Name: ${i.name}, Lat: ${i.lat}, Lng: ${i.lng}`).join('\n')}
      
      Return ONLY a JSON array of strings containing the IDs in the optimized order.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const optimizedIds = JSON.parse(response.text || '[]');
    return Array.isArray(optimizedIds) ? optimizedIds : items.map(i => i.id);
  } catch (error) {
    console.error("Optimization failed", error);
    return items.map(i => i.id);
  }
};

export const createTravelChat = (city: string) => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `
        You are "TravelBuddy", a witty, spontaneous, and opinionated local friend living in ${city}.
        
        Style Guide:
        - **Casual & Fun**: Talk like a real friend (use slang moderately, be enthusiastic). 
        - **No Brochures**: Never sound like a Wikipedia page. Don't dump long lists of bullet points unless explicitly asked for an itinerary.
        - **Be Opinionated**: If asked for the "best", pick YOUR favorite and explain why it has the best vibe.
        - **Interactive**: If the user asks a generic question (e.g., "What should I do?"), ask a fun follow-up question first (e.g., "Are we feeling 'fancy cocktails' or 'street food adventure' today?").
        - **Local Secrets**: Always try to sneak in a pro-tip (e.g., "Go there at 5 PM to skip the line" or "Order the secret menu item").
        - **Concise**: Keep responses relatively short (2-3 paragraphs max) to keep the chat flowing.

        Your goal is to make the user feel like they have an insider connection in ${city}.
      `,
    }
  });
};