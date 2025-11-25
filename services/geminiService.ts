import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DailyContent, Verse } from "../types";

// A chave padrão fornecida
const DEFAULT_API_KEY = "AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g";

// Schema para quando a IA precisa gerar TUDO (caso a API falhe)
const fullGenerationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scriptureVerses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.INTEGER },
          text: { type: Type.STRING }
        }
      },
      description: "O texto bíblico completo, versículo por versículo."
    },
    interpretation: { type: Type.STRING, description: "Interpretação concisa focada em sabedoria (3 frases). Use markdown bold (**texto**)." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos e curtos para o dia a dia. Use markdown bold (**texto**)."
    },
    reflectionQuestion: { type: Type.STRING, description: "Pergunta de reflexão única baseada no capítulo. USE **negrito**." },
    historicalCuriosity: { type: Type.STRING, description: "Fato histórico/cultural específico sobre Salomão ou o contexto destes versículos." }
  },
  required: ["scriptureVerses", "interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

// Schema para quando já temos o texto da API e queremos só a reflexão
const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { type: Type.STRING, description: "Interpretação concisa focada em sabedoria (3 frases). Use markdown bold (**texto**)." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos e curtos para o dia a dia. Use markdown bold (**texto**)."
    },
    reflectionQuestion: { type: Type.STRING, description: "Pergunta de reflexão única baseada no capítulo. USE **negrito**." },
    historicalCuriosity: { type: Type.STRING, description: "Fato histórico/cultural específico sobre Salomão ou o contexto destes versículos." }
  },
  required: ["interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

// Função auxiliar para buscar na API externa
async function fetchVersesFromAPI(day: number): Promise<Verse[] | null> {
  try {
    // Busca na abibliadigital: versão NVI (nvi), livro Provérbios (pv), capítulo {day}
    const response = await fetch(`https://www.abibliadigital.com.br/api/verses/nvi/pv/${day}`);
    
    if (!response.ok) {
      console.warn(`API Bíblia retornou status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data && data.verses && Array.isArray(data.verses)) {
      return data.verses.map((v: any) => ({
        verse: v.number,
        text: v.text
      }));
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar na API abibliadigital:", error);
    return null;
  }
}

export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  const apiKey = DEFAULT_API_KEY; 
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Tentar buscar o texto oficial da API primeiro (Híbrido)
    const officialVerses = await fetchVersesFromAPI(day);
    
    // Configuração do Modelo
    const model = "gemini-2.5-flash";

    if (officialVerses) {
      // --- CAMINHO A: API FUNCIONOU (Texto Oficial + IA Reflexão) ---
      
      const versesText = officialVerses.map(v => `${v.verse}. ${v.text}`).join("\n");
      
      const prompt = `
        Analise o seguinte texto bíblico de Provérbios Capítulo ${day} (NVI):
        
        ${versesText}
        
        Com base EXCLUSIVAMENTE neste texto, atue como um mentor sábio e forneça:
        1. Uma interpretação profunda (3 frases).
        2. 3 passos práticos para o dia a dia.
        3. Uma pergunta de reflexão.
        4. Uma curiosidade histórica sobre Salomão ou o contexto deste capítulo.
        
        Use formatação markdown (**negrito**) para destacar palavras chaves.
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: metadataSchema,
          temperature: 0.7,
        },
      });

      const text = response.text;
      if (!text) throw new Error("IA não gerou reflexão");
      const aiData = JSON.parse(text);

      return {
        day: day,
        scriptureReference: `Provérbios ${day}`,
        scriptureVerses: officialVerses, // Usa o texto confiável da API
        interpretation: aiData.interpretation,
        practicalSteps: aiData.practicalSteps,
        reflectionQuestion: aiData.reflectionQuestion,
        historicalCuriosity: aiData.historicalCuriosity
      };

    } else {
      // --- CAMINHO B: API FALHOU (Fallback para Geração Total via IA) ---
      console.log("Usando fallback de IA para texto bíblico");
      
      const prompt = `
        ATENÇÃO: Transcrição EXATA da Bíblia.
        
        LIVRO: Provérbios
        CAPÍTULO: ${day}
        VERSÃO: NVI (Nova Versão Internacional) - Português Brasil.
        
        IMPORTANTE: 
        - Você DEVE fornecer o texto bíblico COMPLETO deste capítulo.
        - NÃO PULE NENHUM VERSÍCULO. Se o capítulo tiver 35 versículos, forneça os 35.
        - NÃO RESUMA.
        - Certifique-se de que é Provérbios e NÃO Mateus ou outro livro.
        
        Além do texto, forneça:
        1. Interpretação.
        2. Passos práticos.
        3. Pergunta de reflexão.
        4. Curiosidade histórica.
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: fullGenerationSchema,
          temperature: 0.1, // Temperatura mínima para máxima fidelidade ao texto
        },
      });

      const text = response.text;
      if (!text) throw new Error("IA não gerou resposta");
      const aiData = JSON.parse(text);

      return {
        day: day,
        scriptureReference: `Provérbios ${day}`,
        scriptureVerses: aiData.scriptureVerses,
        interpretation: aiData.interpretation,
        practicalSteps: aiData.practicalSteps,
        reflectionQuestion: aiData.reflectionQuestion,
        historicalCuriosity: aiData.historicalCuriosity
      };
    }

  } catch (error: any) {
    console.error("Erro na Jornada:", error);
    return null;
  }
};