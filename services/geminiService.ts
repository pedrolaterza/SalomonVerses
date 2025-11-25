import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// A chave padrão fornecida
const DEFAULT_API_KEY = "AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g";

const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { type: Type.STRING, description: "Interpretação concisa (3 frases). Use markdown bold (**texto**)." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos curtos. Use markdown bold (**texto**)."
    },
    reflectionQuestion: { type: Type.STRING, description: "Pergunta de reflexão única. USE **negrito**." },
    historicalCuriosity: { type: Type.STRING, description: "Fato histórico breve sobre o contexto." }
  },
  required: ["interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  // 1. GARANTIA ABSOLUTA: O Texto vem do arquivo local primeiro.
  // Não depende de internet, chave de API ou IA para o TEXTO BÍBLICO.
  const chapterLines = PROVERBS_DATA[day];

  if (!chapterLines || chapterLines.length === 0) {
    console.error(`ERRO CRÍTICO: Texto do dia ${day} não encontrado no banco de dados.`);
    // Fallback de emergência para não quebrar a tela
    return {
      day,
      scriptureReference: `Provérbios ${day}`,
      scriptureVerses: [{ verse: 1, text: "Texto em breve..." }],
      interpretation: "...",
      practicalSteps: [],
      reflectionQuestion: "...",
      historicalCuriosity: ""
    };
  }

  // Formatar versículos
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));

  // 2. Definir valores PADRÃO para a reflexão
  let interpretation = "A sabedoria de Salomão é atemporal. Leia o texto com calma e medite em cada versículo.";
  let practicalSteps = [
    "Leia o capítulo inteiro com atenção.",
    "Escolha um versículo que tocou seu coração.",
    "Ore pedindo sabedoria para aplicar isso hoje."
  ];
  let reflectionQuestion = "Qual versículo mais chamou sua atenção neste capítulo e por quê?";
  let historicalCuriosity = "O livro de Provérbios é um compilado de sabedoria prática para a vida, escrito majoritariamente pelo Rei Salomão.";

  // 3. Tentar enriquecer com IA APENAS para a reflexão
  try {
    const apiKey = DEFAULT_API_KEY; 
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";

    const prompt = `
      Gere uma reflexão curta para Provérbios capítulo ${day}.
      Foque na sabedoria prática.
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
    
    if (aiData) {
      interpretation = aiData.interpretation || interpretation;
      practicalSteps = aiData.practicalSteps || practicalSteps;
      reflectionQuestion = aiData.reflectionQuestion || reflectionQuestion;
      historicalCuriosity = aiData.historicalCuriosity || historicalCuriosity;
    }
  } catch (aiError) {
    console.warn("IA offline ou bloqueada. Usando metadados padrão. O texto bíblico permanece seguro.");
  }
  
  // 4. Retornar o conteúdo blindado
  return {
    day: day,
    scriptureReference: `Provérbios ${day}`,
    scriptureVerses: verses,
    interpretation: interpretation,
    practicalSteps: practicalSteps,
    reflectionQuestion: reflectionQuestion,
    historicalCuriosity: historicalCuriosity
  };
};