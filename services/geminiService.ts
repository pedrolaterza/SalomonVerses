
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { type: Type.STRING, description: "Interpretação única e específica para ESTE capítulo. Não seja genérico. Use markdown bold (**texto**)." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos e acionáveis extraídos diretamente dos versículos deste capítulo. Use markdown bold (**texto**)."
    },
    reflectionQuestion: { type: Type.STRING, description: "Uma pergunta profunda e provocativa baseada em um versículo específico deste capítulo. USE **negrito**." },
    historicalCuriosity: { type: Type.STRING, description: "Uma curiosidade histórica, cultural ou etimológica ÚNICA sobre este capítulo específico." }
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

  // Formatar versículos para exibição
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));
  
  // Preparar texto para a IA
  const fullTextForAI = chapterLines.join(" ");

  // 2. Definir valores PADRÃO (Fallback) caso a IA falhe
  // Estes valores só aparecem se a API do Google cair ou bloquear o pedido.
  let interpretation = "A sabedoria de Salomão é profunda. Releia o texto e medite em como ele se aplica à sua vida hoje.";
  let practicalSteps = [
    "Leia o capítulo novamente com calma.",
    "Identifique um versículo que falou com você.",
    "Escreva como você pode mudar uma atitude hoje."
  ];
  let reflectionQuestion = "O que Deus falou ao seu coração através destes versículos?";
  let historicalCuriosity = "O livro de Provérbios é um compilado de sabedoria prática para a vida.";

  // 3. Tentar enriquecer com IA
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-2.5-flash";

    const prompt = `
      Você é um teólogo sábio e historiador bíblico.
      
      Sua tarefa é analisar o TEXTO ABAIXO do livro de Provérbios, Capítulo ${day}.
      
      TEXTO PARA ANÁLISE:
      "${fullTextForAI}"

      INSTRUÇÕES ESTRITAS:
      1. IGNORE qualquer conhecimento prévio genérico. Baseie-se APENAS no texto acima.
      2. A interpretação deve citar temas específicos que aparecem nestes versículos.
      3. A curiosidade histórica deve ser sobre uma palavra, costume ou contexto ESPECÍFICO deste capítulo (não fale sobre Salomão em geral).
      4. A pergunta de reflexão deve tocar na ferida, ser pessoal e baseada no texto.

      Gere a resposta em JSON seguindo o esquema solicitado.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: metadataSchema,
        temperature: 0.7,
        // Configurações de segurança para evitar bloqueio de texto religioso/bíblico
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      },
    });

    const responseText = response.text;
    if (responseText) {
      const aiData = JSON.parse(responseText);
      if (aiData) {
        // Só sobrescrevemos se os dados existirem
        if (aiData.interpretation) interpretation = aiData.interpretation;
        if (aiData.practicalSteps && Array.isArray(aiData.practicalSteps)) practicalSteps = aiData.practicalSteps;
        if (aiData.reflectionQuestion) reflectionQuestion = aiData.reflectionQuestion;
        if (aiData.historicalCuriosity) historicalCuriosity = aiData.historicalCuriosity;
      }
    }
  } catch (aiError) {
    console.warn("IA offline ou bloqueada. Detalhes:", aiError);
    // Se der erro, usamos o fallback definido acima, mas o texto bíblico (PROVERBS_DATA) continua garantido.
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
