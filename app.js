/* ============================================================
   ALQUERQUE — DESENHO E LIGAÇÃO À PÁGINA
   ------------------------------------------------------------
   1. desenharTabuleiro() → pinta o estado no <svg>.
      Apaga e redesenha tudo: simples e sem surpresas.
      Para atualizar o ecrã basta trocar o estado e chamar
      atualizar() (ex.: quando chegar uma mensagem do servidor).
   2. aoClicarCasa(linha, coluna) → seleciona peças, joga,
      e sopra. As regras estão todas no tabuleiro.js.
   3. Mensagens, slider do tamanho.

   As cores e tamanhos visuais estão no style.css (zona 3).
   ============================================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ALTERAR AQUI: geometria do desenho (unidades do SVG,
   não píxeis — o SVG estica para caber na página). */
const ESPACO = 100;      /* distância entre dois pontos */
const MARGEM = 50;       /* margem à volta do tabuleiro */
const RAIO_PECA = 30;
const RAIO_PONTO = 6;
const RAIO_DESTINO = 16; /* marca dos pontos para onde se pode jogar */
const RAIO_CLIQUE = 45;  /* área clicável à volta de cada ponto */

/* ALTERAR AQUI: nomes dos jogadores nas mensagens */
const NOMES = { 1: 'brancas', 2: 'pretas' };

const svg = document.getElementById('tabuleiro-svg');
const slider = document.getElementById('tamanho-slider');
const sliderValor = document.getElementById('tamanho-valor');
const mensagem = document.getElementById('mensagem');
const mensagemVez = document.getElementById('mensagem-vez');
const confirmacao = document.getElementById('confirmacao');
const botaoSim = document.getElementById('confirmar-sim');
const botaoNao = document.getElementById('confirmar-nao');
const botaoJogo = document.getElementById('botao-jogo');

/* estado → partilhado (no multiplayer vem do servidor)
   selecao → só deste ecrã: a peça escolhida e as suas jogadas */
let estado = criarEstado(Number(slider.value));
let selecao = { peca: null, jogadas: [] };
let jogoComecou = false;   /* false até à primeira jogada */
let aConfirmar = false;    /* true enquanto se pergunta "Desistir mesmo?" */


/* ---------- 1. Desenho ---------- */

/* Cria um elemento SVG com atributos: el('circle', {r: 5}) */
function el(tipo, atributos) {
  const elemento = document.createElementNS(SVG_NS, tipo);
  for (const nome in atributos) elemento.setAttribute(nome, atributos[nome]);
  return elemento;
}

/* Converte linha/coluna em coordenadas do desenho */
function px(i) {
  return MARGEM + i * ESPACO;
}

function desenharTabuleiro() {
  const n = estado.tamanho;
  const lado = 2 * MARGEM + (n - 1) * ESPACO;
  svg.setAttribute('viewBox', '0 0 ' + lado + ' ' + lado);
  svg.replaceChildren();

  /* Fundo */
  svg.appendChild(el('rect', { class: 'tabuleiro-fundo', x: 0, y: 0, width: lado, height: lado }));

  /* Linhas */
  const grupoLinhas = el('g', { class: 'tabuleiro-linhas' });
  for (const [l1, c1, l2, c2] of ligacoes(n)) {
    grupoLinhas.appendChild(el('line', { x1: px(c1), y1: px(l1), x2: px(c2), y2: px(l2) }));
  }
  svg.appendChild(grupoLinhas);

  /* Pontos e peças. Cada ponto é um <g class="casa"> com
     data-linha / data-coluna, para saber onde se clicou. */
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) {
      const aqui = [l, c];
      const grupo = el('g', { class: 'casa', 'data-linha': l, 'data-coluna': c });
      const jogada = selecao.jogadas.find(function (j) { return igual(j.para, aqui); });

      /* Classes que o style.css usa para os realces */
      if (jogadasPermitidas(estado, l, c).length > 0) grupo.classList.add('jogavel');
      if (igual(selecao.peca, aqui)) grupo.classList.add('selecionada');
      if (contem(estado.sopro, aqui)) grupo.classList.add('soprada');
      if (selecao.jogadas.some(function (j) { return igual(j.captura, aqui); })) grupo.classList.add('alvo');

      grupo.appendChild(el('circle', { class: 'casa-clique', cx: px(c), cy: px(l), r: RAIO_CLIQUE }));
      grupo.appendChild(el('circle', { class: 'casa-ponto', cx: px(c), cy: px(l), r: RAIO_PONTO }));

      const dono = casaEm(estado, l, c);
      if (dono !== VAZIO) {
        grupo.appendChild(el('circle', {
          class: 'peca peca-jogador' + dono, cx: px(c), cy: px(l), r: RAIO_PECA
        }));
      }

      /* Destino legal da peça selecionada */
      if (jogada) {
        grupo.appendChild(el('circle', {
          class: jogada.captura ? 'destino destino-captura' : 'destino',
          cx: px(c), cy: px(l), r: RAIO_DESTINO
        }));
      }
      svg.appendChild(grupo);
    }
  }
}


/* ---------- 2. Cliques ---------- */

/* Um único "ouvinte" no SVG inteiro: descobre a casa clicada
   pelos atributos data-*. Funciona mesmo após redesenhar. */
svg.addEventListener('click', function (evento) {
  const casa = evento.target.closest('.casa');
  if (!casa) return;
  aoClicarCasa(Number(casa.dataset.linha), Number(casa.dataset.coluna));
});

function selecionar(ponto) {
  selecao = ponto
    ? { peca: ponto, jogadas: jogadasPermitidas(estado, ponto[0], ponto[1]) }
    : { peca: null, jogadas: [] };
}

/* No multiplayer, em vez de chamar aplicarJogada/soprar aqui,
   envia-se a ação ao servidor e redesenha-se com o estado que
   ele devolver. */
function aoClicarCasa(linha, coluna) {
  if (estado.vencedor) return;
  aConfirmar = false;          /* clicar no tabuleiro cancela a desistência */
  const ponto = [linha, coluna];
  const eu = NOMES[estado.vez];
  const ele = NOMES[adversario(estado.vez)];

  /* a) Regra do sopro: clicar numa peça marcada retira-a */
  if (contem(estado.sopro, ponto)) {
    soprar(estado, linha, coluna);
    jogoComecou = true;
    selecionar(estado.emCadeia);
    atualizar('As ' + eu + ' sopraram uma peça das ' + ele + '.');
    return;
  }

  /* b) Clicar num destino legal da peça selecionada → jogar */
  const jogada = selecao.jogadas.find(function (j) { return igual(j.para, ponto); });
  if (jogada) {
    const r = aplicarJogada(estado, selecao.peca, ponto);
    jogoComecou = true;
    selecionar(r.continua ? ponto : null);
    let texto;
    if (r.continua) texto = 'As ' + eu + ' capturaram uma peça e podem capturar outra vez.';
    else if (r.captura) texto = 'As ' + eu + ' capturaram uma peça.';
    else texto = 'As ' + eu + ' moveram uma peça.';
    if (r.faltosas > 0) texto += ' Podiam ter capturado e não o fizeram!';
    atualizar(texto);
    return;
  }

  /* c) A meio de capturas seguidas, a peça fica presa à seleção */
  if (estado.emCadeia) {
    selecionar(estado.emCadeia);
    atualizar('Tens de continuar a capturar com a peça selecionada.');
    return;
  }

  /* d) Clicar numa peça própria → selecionar / desselecionar */
  if (casaEm(estado, linha, coluna) === estado.vez) {
    if (igual(selecao.peca, ponto)) {
      selecionar(null);
      atualizar();
    } else if (jogadasPermitidas(estado, linha, coluna).length === 0) {
      selecionar(null);
      atualizar('Essa peça não tem jogadas possíveis.');
    } else {
      selecionar(ponto);
      atualizar();
    }
    return;
  }

  /* e) Outro sítio qualquer → limpar seleção */
  selecionar(null);
  atualizar();
}


/* ---------- 3. Página ---------- */

/* Redesenha o tabuleiro e as duas linhas de mensagem:
     1.ª (#mensagem-vez) → de quem é a vez — sempre visível
     2.ª (#mensagem)     → o que acabou de acontecer
   Sem texto (atualizar()), a 2.ª linha fica como estava. */
function atualizar(texto) {
  desenharTabuleiro();
  if (texto !== undefined) {
    mensagem.textContent = texto;
    mensagem.hidden = !texto;
  }
  mostrarVez();
  atualizarControlos();
}

/* ALTERAR AQUI: os textos da linha principal (de quem é a vez) */
function mostrarVez() {
  mensagemVez.replaceChildren();
  const quem = estado.vencedor || estado.vez;
  const cor = [etiqueta(quem)];

  if (aConfirmar) {
    mensagemVez.append('Desistir mesmo? As ', ...cor, ' perdem a partida.');
  } else if (estado.desistiu) {
    mensagemVez.append('As ', etiqueta(estado.desistiu), ' desistiram. Ganharam as ', ...cor, '!');
  } else if (estado.vencedor) {
    mensagemVez.append('Fim do jogo: ganharam as ', ...cor, '!');
  } else if (!jogoComecou) {
    mensagemVez.append('Início do jogo: começam as ', ...cor, '.');
  } else if (estado.emCadeia) {
    mensagemVez.append('Continuam as ', ...cor, ': têm de capturar outra vez com a mesma peça.');
  } else if (estado.sopro.length > 0) {
    mensagemVez.append('Agora jogam as ', ...cor,
      '. Podem soprar a peça a tracejado (clicar nela) antes de jogar.');
  } else {
    mensagemVez.append('Agora jogam as ', ...cor, '.');
  }
}

/* Bolinha com a cor do jogador + nome, sempre juntos na mesma linha */
function etiqueta(jogador) {
  const bolinha = document.createElement('span');
  bolinha.className = 'mensagem-peca mensagem-peca-jogador' + jogador;
  const span = document.createElement('span');
  span.className = 'mensagem-jogador';
  span.append(bolinha, NOMES[jogador]);
  return span;
}

/* Botão principal, confirmação e slider, conforme o momento do jogo:
     - durante o jogo → "Desistir"; slider bloqueado depois da 1.ª jogada
       (mudar o tamanho a meio seria recomeçar sem desistir)
     - no fim         → "Jogar de novo"; slider livre */
function atualizarControlos() {
  const acabou = estado.vencedor !== null;
  botaoJogo.textContent = acabou ? 'Jogar de novo' : 'Desistir';
  botaoJogo.classList.toggle('botao-novo-jogo', acabou);
  botaoJogo.hidden = aConfirmar;
  confirmacao.hidden = !aConfirmar;
  slider.disabled = jogoComecou && !acabou;
  slider.title = slider.disabled ? 'Para mudar o tamanho, desiste ou termina a partida.' : '';
}

function novoJogo(tamanho) {
  estado = criarEstado(tamanho);
  jogoComecou = false;
  aConfirmar = false;
  selecionar(null);
  sliderValor.textContent = tamanho + '×' + tamanho;
  atualizar('Tabuleiro ' + tamanho + '×' + tamanho + ', ' +
    contarPecas(estado, JOGADOR1) + ' peças para cada jogador.');
}

/* Desistir / Jogar de novo.
   Neste PC, quem desiste é o jogador da vez. No multiplayer será
   o jogador deste PC, e a desistência é enviada ao servidor. */
botaoJogo.addEventListener('click', function () {
  if (estado.vencedor) {
    novoJogo(Number(slider.value));
  } else {
    aConfirmar = true;
    atualizar();
  }
});

botaoSim.addEventListener('click', function () {
  aConfirmar = false;
  desistir(estado, estado.vez);
  selecionar(null);
  atualizar('');
});

botaoNao.addEventListener('click', function () {
  aConfirmar = false;
  atualizar();
});

slider.addEventListener('input', function () {
  novoJogo(Number(slider.value));
});

novoJogo(Number(slider.value));
