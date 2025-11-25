import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DailyContent, Verse } from "../types";

// A chave padrão fornecida
const DEFAULT_API_KEY = "AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g";

// Schema para geração APENAS de metadados (quando já temos o texto)
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

// Schema para geração completa (Fallback de emergência)
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
    interpretation: { type: Type.STRING },
    practicalSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    reflectionQuestion: { type: Type.STRING },
    historicalCuriosity: { type: Type.STRING }
  },
  required: ["scriptureVerses", "interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  const apiKey = DEFAULT_API_KEY; 
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  let verses: Verse[] = [];
  let usingFallback = false;

  // 1. TENTATIVA PRINCIPAL: Buscar texto NVI do GitHub (Arquivo Estático)
  try {
    // Verificar se já temos o livro baixado no cache para economizar dados
    let bookData = localStorage.getItem('bible_nvi_pv_book_v1');
    
    if (!bookData) {
      console.log("Baixando livro de Provérbios NVI do GitHub...");
      // URL do arquivo JSON contendo Provérbios NVI completo
      const response = await fetch('https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nvi/pv.json');
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo do GitHub: ${response.status}`);
      }
      
      bookData = await response.text();
      // Salva no localStorage para acesso instantâneo nas próximas vezes
      try {
        localStorage.setItem('bible_nvi_pv_book_v1', bookData);
      } catch (e) {
        console.warn("Espaço insuficiente no localStorage para cachear o livro todo.");
      }
    }

    const bookJson = JSON.parse(bookData);
    
    // A estrutura do JSON do thiagobodruk geralmente é { "chapters": [ ["v1", "v2"], ["v1"] ... ] }
    // O array chapters é base-0, então dia 1 = index 0
    const chapterTextArray = bookJson.chapters[day - 1];

    if (!chapterTextArray || !Array.isArray(chapterTextArray)) {
      throw new Error("Capítulo não encontrado no arquivo JSON.");
    }

    // Mapear o array de strings para o nosso formato de objeto
    verses = chapterTextArray.map((text: string, index: number) => ({
      verse: index + 1,
      text: text
    }));

    console.log(`Texto do capítulo ${day} recuperado com sucesso do GitHub (${verses.length} versículos).`);

  } catch (error) {
    console.warn("Falha ao buscar texto do GitHub, ativando fallback de IA:", error);
    usingFallback = true;
  }

  try {
    // 2. CHAMADA À IA (GEMINI)
    
    if (!usingFallback && verses.length > 0) {
      // CENÁRIO IDEAL: Temos o texto exato. Pedimos à IA apenas a sabedoria.
      console.log("Gerando apenas reflexão via IA...");
      
      const prompt = `
        Analise o seguinte texto bíblico de Provérbios ${day} (NVI):
        ${JSON.stringify(verses)}
        
        Com base EXCLUSIVAMENTE neste texto, gere:
        1. Uma interpretação sábia e moderna (3 frases).
        2. 3 passos práticos para aplicar hoje.
        3. Uma pergunta de reflexão profunda.
        4. Uma curiosidade histórica sobre este contexto específico.
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

      const aiData = JSON.parse(response.text!);
      
      return {
        day: day,
        scriptureReference: `Provérbios ${day}`,
        scriptureVerses: verses, // Usa o texto fiel do GitHub
        interpretation: aiData.interpretation,
        practicalSteps: aiData.practicalSteps,
        reflectionQuestion: aiData.reflectionQuestion,
        historicalCuriosity: aiData.historicalCuriosity
      };

    } else {
      // CENÁRIO DE EMERGÊNCIA: GitHub falhou. IA gera tudo (Modo Transcrição Rigorosa).
      console.log("Usando IA para transcrição completa (Fallback)...");
      
      const prompt = `
        ATUE COMO UM TRANSCRITOR BÍBLICO.
        Transcreva PROVÉRBIOS CAPÍTULO ${day} da versão NVI (Nova Versão Internacional).
        
        REGRAS:
        1. Traga TODOS os versículos. NÃO pule nenhum.
        2. Texto deve ser exato.
        3. Gere também interpretação, passos práticos, reflexão e curiosidade.
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: fullGenerationSchema,
          temperature: 0.2, // Baixa criatividade para garantir fidelidade
        },
      });

      const aiData = JSON.parse(response.text!);
      
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
    console.error("Erro fatal no serviço:", error);
    return null;
  }
};