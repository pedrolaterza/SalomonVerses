import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// A chave padrão fornecida
const DEFAULT_API_KEY = "AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g";

const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { type: Type.STRING, description: "Interpretação concisa (3 frases) específica deste capítulo. Use markdown bold (**texto**)." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos curtos baseados neste texto. Use markdown bold (**texto**)."
    },
    reflectionQuestion: { type: Type.STRING, description: "Uma pergunta profunda baseada em um versículo específico deste capítulo. USE **negrito**." },
    historicalCuriosity: { type: Type.STRING, description: "Fato histórico ou cultural breve relacionado especificamente a este capítulo." }
  },
  required: ["interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  // 1. GARANTIA ABSOLUTA: O Texto vem do arquivo local primeiro.
  const chapterLines = PROVERBS_DATA[day];

  if (!chapterLines || chapterLines.length === 0) {
    console.error(`ERRO CRÍTICO: Texto do dia ${day} não encontrado no banco de dados.`);
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

  // Formatar versículos para exibição e para a IA ler
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));
  
  const fullTextForAI = chapterLines.join(" ");

  // 2. Definir valores PADRÃO (Fallback) caso a IA falhe
  let interpretation = "A sabedoria de Salomão é profunda. Releia o texto e medite em como ele se aplica à sua vida hoje.";
  let practicalSteps = [
    "Leia o capítulo novamente com calma.",
    "Identifique um versículo que falou com você.",
    "Escreva como você pode mudar uma atitude hoje."
  ];
  let reflectionQuestion = "O que Deus falou ao seu coração através destes versículos?";
  let historicalCuriosity = "Provérbios foi escrito para dar sabedoria aos simples e conhecimento aos jovens.";

  // 3. Tentar enriquecer com IA
  try {
    const apiKey = DEFAULT_API_KEY; 
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";

    // PROMPT MELHORADO: Envia o texto junto para a IA analisar
    const prompt = `
      Atue como um especialista em teologia e história bíblica.
      
      Analise o seguinte texto de Provérbios Capítulo ${day} (Versão NVI):
      "${fullTextForAI}"

      Com base EXCLUSIVAMENTE neste texto acima, gere um JSON com:
      1. interpretation: Uma explicação simples e moderna do tema central deste capítulo.
      2. practicalSteps: 3 ações práticas que uma pessoa pode fazer hoje baseadas nestes versículos.
      3. reflectionQuestion: Uma pergunta que faça a pessoa pensar sobre sua própria vida à luz deste texto.
      4. historicalCuriosity: Uma curiosidade sobre os costumes, cultura ou palavras originais deste capítulo específico.
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

    const responseText = response.text;
    if (responseText) {
      const aiData = JSON.parse(responseText);
      if (aiData) {
        interpretation = aiData.interpretation || interpretation;
        practicalSteps = aiData.practicalSteps || practicalSteps;
        reflectionQuestion = aiData.reflectionQuestion || reflectionQuestion;
        historicalCuriosity = aiData.historicalCuriosity || historicalCuriosity;
      }
    }
  } catch (aiError) {
    console.warn("IA offline, bloqueada ou sem cota. Usando metadados padrão.", aiError);
    // Não fazemos nada, mantemos os valores padrão definidos acima
    // O usuário ainda verá o texto bíblico correto.
  }
  
  // 4. Retornar o conteúdo (Texto Fixo + Insights da IA ou Padrão)
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