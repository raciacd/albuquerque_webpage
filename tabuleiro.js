/* ============================================================
   ALQUERQUE — MODELO E REGRAS DO JOGO
   ------------------------------------------------------------
   Este ficheiro NÃO mexe na página (não usa document/DOM).
   Só descreve o tabuleiro, o estado do jogo e as regras.

   Porquê separado? Na segunda entrega (multiplayer) o servidor
   pode usar este mesmo ficheiro para validar as jogadas, e o
   estado — um objeto feito só de números e arrays — pode ser
   enviado em JSON entre o servidor e os vários PCs. O desenho
   (app.js) limita-se a pintar o estado que receber.

   Geometria (Alquerque):
     - Tabuleiro de N×N pontos (intersecções).
     - Todos os pontos ligam-se na horizontal e na vertical.
     - Só os pontos com (linha + coluna) par têm diagonais.
       (No 5×5 clássico: cantos, centro e pontos alternados.)

   Regras:
     - Mover: uma peça vai para um ponto vizinho vazio.
     - Capturar: salta sobre uma peça adversária vizinha para
       o ponto vazio logo a seguir, na mesma linha. Se depois
       puder capturar outra vez, continua com a mesma peça.
     - Sopro: se um jogador podia capturar e fez uma jogada
       simples, o adversário pode, na sua vez, soprar (retirar)
       uma das peças que deviam ter capturado. Soprar não gasta
       a jogada. Se não soprar logo, perde essa oportunidade.
     - Perde quem ficar sem peças ou sem jogadas, ou quem desistir.
   ============================================================ */

const VAZIO = 0;
const JOGADOR1 = 1;   /* brancas, em baixo, jogam primeiro */
const JOGADOR2 = 2;   /* pretas, em cima */

/* ALTERAR AQUI: true = as jogadas simples só podem ir para a
   frente ou para os lados (versão tradicional). As capturas
   podem ser feitas em qualquer direção. */
const SO_PARA_A_FRENTE = false;

/* As 8 direções possíveis: [dLinha, dColuna] */
const DIRECOES = [
  [-1, 0], [1, 0], [0, -1], [0, 1],     /* ortogonais */
  [-1, -1], [-1, 1], [1, -1], [1, 1]    /* diagonais */
];


/* ---------- Coordenadas ---------- */

/* O tabuleiro é guardado num array simples, linha a linha. */
function indice(tamanho, linha, coluna) {
  return linha * tamanho + coluna;
}

function dentro(tamanho, linha, coluna) {
  return linha >= 0 && linha < tamanho && coluna >= 0 && coluna < tamanho;
}

function temDiagonais(linha, coluna) {
  return (linha + coluna) % 2 === 0;
}

/* Compara dois pontos [linha, coluna] */
function igual(a, b) {
  return a != null && b != null && a[0] === b[0] && a[1] === b[1];
}

function contem(lista, ponto) {
  return lista.some(function (p) { return igual(p, ponto); });
}

function adversario(jogador) {
  return jogador === JOGADOR1 ? JOGADOR2 : JOGADOR1;
}


/* ---------- Ligações ---------- */

/* Pontos ligados a (linha, coluna) por uma linha do tabuleiro. */
function vizinhos(tamanho, linha, coluna) {
  const lista = [];
  for (const [dl, dc] of DIRECOES) {
    const diagonal = dl !== 0 && dc !== 0;
    if (diagonal && !temDiagonais(linha, coluna)) continue;
    const l = linha + dl, c = coluna + dc;
    if (dentro(tamanho, l, c)) lista.push([l, c]);
  }
  return lista;
}

/* Todos os segmentos a desenhar, cada um uma só vez:
   [linha1, coluna1, linha2, coluna2] */
function ligacoes(tamanho) {
  const segmentos = [];
  const metade = [[0, 1], [1, 0], [1, 1], [1, -1]];   /* evita repetir */
  for (let l = 0; l < tamanho; l++) {
    for (let c = 0; c < tamanho; c++) {
      for (const [dl, dc] of metade) {
        const diagonal = dl !== 0 && dc !== 0;
        if (diagonal && !temDiagonais(l, c)) continue;
        if (dentro(tamanho, l + dl, c + dc)) segmentos.push([l, c, l + dl, c + dc]);
      }
    }
  }
  return segmentos;
}


/* ---------- Posição inicial ---------- */

/* ALTERAR AQUI: a disposição inicial das peças.
   Tamanho ímpar (ex. 5×5 clássico, 12 peças cada):
     linhas de cima → jogador 2, linhas de baixo → jogador 1,
     linha do meio dividida ao meio, com o centro vazio.
   Tamanho par: não há centro, por isso as duas linhas
     centrais começam vazias. */
function donoInicial(tamanho, linha, coluna) {
  if (tamanho % 2 === 1) {
    const meio = (tamanho - 1) / 2;
    if (linha < meio) return JOGADOR2;
    if (linha > meio) return JOGADOR1;
    if (coluna < meio) return JOGADOR2;
    if (coluna > meio) return JOGADOR1;
    return VAZIO;
  }
  if (linha < tamanho / 2 - 1) return JOGADOR2;
  if (linha > tamanho / 2) return JOGADOR1;
  return VAZIO;
}


/* ---------- Estado do jogo ---------- */

/* Tudo o que é partilhado entre os jogadores.
   É este objeto que o servidor vai enviar na 2.ª entrega.
   (A peça selecionada NÃO está aqui: é de cada ecrã, ver app.js.) */
function criarEstado(tamanho) {
  const casas = [];
  for (let l = 0; l < tamanho; l++) {
    for (let c = 0; c < tamanho; c++) {
      casas.push(donoInicial(tamanho, l, c));
    }
  }
  return {
    tamanho: tamanho,
    casas: casas,          /* VAZIO, JOGADOR1 ou JOGADOR2 por ponto */
    vez: JOGADOR1,         /* de quem é a vez */
    emCadeia: null,        /* [l, c] da peça a meio de capturas seguidas */
    sopro: [],             /* [[l, c], ...] peças do adversário que se podem soprar */
    vencedor: null,        /* JOGADOR1 / JOGADOR2 quando o jogo acaba */
    desistiu: null         /* jogador que desistiu, se o jogo acabou assim */
  };
}

function casaEm(estado, linha, coluna) {
  return estado.casas[indice(estado.tamanho, linha, coluna)];
}

function porCasa(estado, ponto, valor) {
  estado.casas[indice(estado.tamanho, ponto[0], ponto[1])] = valor;
}

function contarPecas(estado, jogador) {
  return estado.casas.filter(function (dono) { return dono === jogador; }).length;
}


/* ---------- Jogadas ---------- */

/* Todas as jogadas de uma peça, ignorando de quem é a vez.
   Cada jogada: { para: [l, c], captura: [l, c] ou null } */
function jogadasDaPeca(estado, linha, coluna) {
  const n = estado.tamanho;
  const jogador = casaEm(estado, linha, coluna);
  if (jogador === VAZIO) return [];

  const frente = jogador === JOGADOR1 ? -1 : 1;   /* brancas sobem, pretas descem */
  const lista = [];

  for (const [l1, c1] of vizinhos(n, linha, coluna)) {
    const dl = l1 - linha, dc = c1 - coluna;
    const vizinho = casaEm(estado, l1, c1);

    if (vizinho === VAZIO) {
      if (SO_PARA_A_FRENTE && dl === -frente) continue;   /* para trás */
      lista.push({ para: [l1, c1], captura: null });
    } else if (vizinho === adversario(jogador)) {
      /* salto na mesma direção: o ponto a seguir tem de estar vazio */
      const l2 = l1 + dl, c2 = c1 + dc;
      if (dentro(n, l2, c2) && casaEm(estado, l2, c2) === VAZIO) {
        lista.push({ para: [l2, c2], captura: [l1, c1] });
      }
    }
  }
  return lista;
}

function capturasDaPeca(estado, linha, coluna) {
  return jogadasDaPeca(estado, linha, coluna).filter(function (j) { return j.captura; });
}

/* Peças de um jogador que podem capturar neste momento */
function pecasQuePodemCapturar(estado, jogador) {
  const lista = [];
  for (let l = 0; l < estado.tamanho; l++) {
    for (let c = 0; c < estado.tamanho; c++) {
      if (casaEm(estado, l, c) === jogador && capturasDaPeca(estado, l, c).length > 0) {
        lista.push([l, c]);
      }
    }
  }
  return lista;
}

function temJogadas(estado, jogador) {
  for (let l = 0; l < estado.tamanho; l++) {
    for (let c = 0; c < estado.tamanho; c++) {
      if (casaEm(estado, l, c) === jogador && jogadasDaPeca(estado, l, c).length > 0) return true;
    }
  }
  return false;
}

/* Jogadas que o jogador da vez pode MESMO fazer com esta peça.
   É isto que o app.js usa para mostrar os destinos. */
function jogadasPermitidas(estado, linha, coluna) {
  if (estado.vencedor) return [];
  if (casaEm(estado, linha, coluna) !== estado.vez) return [];
  if (estado.emCadeia) {
    /* a meio de capturas seguidas: só a mesma peça, só capturas */
    if (!igual(estado.emCadeia, [linha, coluna])) return [];
    return capturasDaPeca(estado, linha, coluna);
  }
  return jogadasDaPeca(estado, linha, coluna);
}


/* ---------- Aplicar ações ---------- */

/* Move a peça de "de" para "para". Devolve null se a jogada não
   for válida, ou um resumo: { captura, continua, faltosas }
     captura  → houve captura
     continua → o mesmo jogador tem de capturar outra vez
     faltosas → nº de peças que ficam sujeitas a sopro */
function aplicarJogada(estado, de, para) {
  const jogada = jogadasPermitidas(estado, de[0], de[1]).find(function (j) {
    return igual(j.para, para);
  });
  if (!jogada) return null;

  const jogador = estado.vez;

  /* Regra do sopro: antes de mexer, ver quem podia capturar */
  const podiamCapturar = estado.emCadeia ? [] : pecasQuePodemCapturar(estado, jogador);

  /* O jogador jogou sem soprar: perde essa oportunidade */
  estado.sopro = [];

  porCasa(estado, de, VAZIO);
  porCasa(estado, para, jogador);

  if (jogada.captura) {
    porCasa(estado, jogada.captura, VAZIO);
    if (capturasDaPeca(estado, para[0], para[1]).length > 0) {
      estado.emCadeia = para;               /* continua a capturar */
      return { captura: true, continua: true, faltosas: 0 };
    }
    estado.emCadeia = null;
    passarVez(estado);
    return { captura: true, continua: false, faltosas: 0 };
  }

  /* Jogada simples: se havia capturas, essas peças podem ser sopradas.
     Se foi a própria peça faltosa que se mexeu, conta a nova posição. */
  estado.sopro = podiamCapturar.map(function (p) { return igual(p, de) ? para : p; });
  passarVez(estado);
  return { captura: false, continua: false, faltosas: estado.sopro.length };
}

/* O jogador da vez sopra uma peça do adversário. Não gasta a jogada. */
function soprar(estado, linha, coluna) {
  if (estado.vencedor || !contem(estado.sopro, [linha, coluna])) return false;
  porCasa(estado, [linha, coluna], VAZIO);
  estado.sopro = [];
  verificarFim(estado);
  return true;
}

/* Um jogador desiste: o adversário ganha e o jogo acaba. */
function desistir(estado, jogador) {
  if (estado.vencedor) return false;
  estado.desistiu = jogador;
  estado.vencedor = adversario(jogador);
  estado.sopro = [];
  estado.emCadeia = null;
  return true;
}

function passarVez(estado) {
  estado.vez = adversario(estado.vez);
  verificarFim(estado);
}

/* Perde quem ficar sem peças, ou sem jogadas na sua vez
   (a não ser que ainda possa soprar, o que pode abrir caminho). */
function verificarFim(estado) {
  const vez = estado.vez, outro = adversario(vez);
  if (contarPecas(estado, outro) === 0) estado.vencedor = vez;
  else if (contarPecas(estado, vez) === 0) estado.vencedor = outro;
  else if (!temJogadas(estado, vez) && estado.sopro.length === 0) estado.vencedor = outro;
}


/* Permite usar este ficheiro no servidor (Node.js) mais tarde. */
if (typeof module !== 'undefined') {
  module.exports = {
    VAZIO, JOGADOR1, JOGADOR2, indice, dentro, temDiagonais, igual, contem,
    adversario, vizinhos, ligacoes, criarEstado, casaEm, contarPecas,
    jogadasDaPeca, jogadasPermitidas, pecasQuePodemCapturar,
    aplicarJogada, soprar, desistir
  };
}
