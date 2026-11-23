// ============================================================
//  CONFIGURAÇÃO DA FESTA — este é o único arquivo que você edita
// ============================================================

// 1) Cole aqui o "firebaseConfig" que o Firebase mostra quando você
//    cria o app da Web (Configurações do projeto > Seus apps).
//    Enquanto "apiKey" estiver vazio, o site roda em MODO DEMONSTRAÇÃO
//    (os dados ficam só no seu aparelho, servem apenas para testar).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 2) O e-mail do organizador (o mesmo que você cadastrar em
//    Authentication > Users no Firebase). Use o mesmo e-mail
//    no arquivo firestore.rules.
export const ADMIN_EMAIL = "";

// 3) Informações que aparecem antes de você salvar algo pelo painel.
//    Depois de salvar no painel do organizador, valem as do painel.
export const EVENT_DEFAULTS = {
  title: "Festa na Casa",
  desc: "Dois dias de festa! Confirme a presença, escolha o que vai levar e vote nas bebidas.",
  date: "2026-11-28",
  date2: "2026-11-29",
  time: "13:00",
  address: "Rua José Marra de Moraes, 561 – Santa Edwirges",
  city: "",
  pixKey: "131.911.346-03",
  pixName: "",
  label25: "Só a festa",
  label50: "Festa + bebidas"
};

// Lista inicial (o organizador cria com um toque no painel)
export const DEFAULT_ITEMS = [
  "Gelo (2 sacos)", "Carvão", "Carne / linguiça", "Pão de alho",
  "Salgadinhos", "Copos e pratos descartáveis", "Guardanapos", "Caixa de som"
];
export const DEFAULT_DRINKS = [
  "Cerveja", "Refrigerante", "Caipirinha", "Vodka com energético", "Suco natural", "Água"
];
