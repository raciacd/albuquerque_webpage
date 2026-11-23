const botao = document.querySelector('.hamburguer');
const menu  = document.getElementById('menu');

botao.addEventListener('click', () => {
  menu.classList.toggle('aberto');
});

/* ===== jogo ===== */

const N = 5;
let tab; // le a matriz 5x5 do tabuleiro: 'B', 'P' ou null
let vez;
let selecionada = null; // {l, c} ou null
let emCaptura = false;
let fim = false;
let penalizadas = []; // pecas do jogador atual que podem vir a ser sopradas
let sopraveis   = []; // pecas do adversario que podem ser sopradas agora
let historico = {};
let ranking = {};
let contraIA = false;
let dificuldade = 'facil';
const REPETICOES = 2;
const tabEl = document.querySelector('.tabuleiro');
const estadoEl = document.getElementById('estado');
const casas = []; // casas[l][c] = o <div> dessa casa
const perguntaEl    = document.getElementById('pergunta-empate');
const textoEmpateEl = document.getElementById('texto-empate');
const tabelaRankingEl = document.getElementById('tabela-ranking');
const COR_IA = 'P';

// criar as linhas do tabuleiro

const svg = document.querySelector('.tabuleiro svg');
const SVG_NS = 'http://www.w3.org/2000/svg';

function criarLinha(x1, y1, x2, y2) {
  const linha = document.createElementNS(SVG_NS, 'line');
  linha.setAttribute('x1', x1);
  linha.setAttribute('y1', y1);
  linha.setAttribute('x2', x2);
  linha.setAttribute('y2', y2);
  svg.appendChild(linha);
}

// linhas horizontais e verticais
for (let i = 0; i <= 400; i += 100) {
  criarLinha(0, i, 400, i);
  criarLinha(i, 0, i, 400);
}

// diagonais grandes
criarLinha(0, 0, 400, 400);
criarLinha(400, 0, 0, 400);

// diagonais pequenas
criarLinha(200, 0, 0, 200);
criarLinha(200, 0, 400, 200);
criarLinha(0, 200, 200, 400);
criarLinha(400, 200, 200, 400);

// criar as 25 casas
for (let l = 0; l < N; l++) {
  casas[l] = [];
  for (let c = 0; c < N; c++) {
    const casa = document.createElement('div');
    casa.className = 'casa';
    casa.dataset.l = l;
    casa.dataset.c = c;
    casa.style.left = (c * 25) + '%';
    casa.style.top  = (l * 25) + '%';
    tabEl.appendChild(casa);
    casas[l][c] = casa;
  }
}

function dentro(l, c) {
  return l >= 0 && l < N && c >= 0 && c < N;
}

function direcoes(l, c) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // pra cima, baixo, lados
  if ((l + c) % 2 === 0) {
    dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]); // diagonais
  }
  return dirs;
}

// jogadas possiveis

function jogadas(l, c, soCapturas, t = tab, cor = vez) {
  const lista   = [];
  const inimigo = outraCor(cor);
  const frente  = (cor === 'B') ? -1 : 1; // brancas sobem, pretas descem

  for (const [dl, dc] of direcoes(l, c)) {
    const paraTras = (dl === -frente);

    const l1 = l + dl,     c1 = c + dc; // vizinho
    const l2 = l + 2 * dl, c2 = c + 2 * dc; // a seguir ao vizinho

    // movimento simples
    if (!soCapturas && !paraTras && dentro(l1, c1) && t[l1][c1] === null) {
      lista.push({ l: l1, c: c1, captura: null });
    }
    // captura: vizinho eh inimigo e a casa a seguinte esta vazia
    if (dentro(l2, c2) && t[l1][c1] === inimigo && t[l2][c2] === null) {
      lista.push({ l: l2, c: c2, captura: { l: l1, c: c1 } });
    }
  }
  return lista;
}

function temJogadas() {
  for (let l = 0; l < N; l++)
    for (let c = 0; c < N; c++)
      if (tab[l][c] === vez && jogadas(l, c, false).length > 0) return true;
  return false;
}

function pecasComCaptura(t = tab, cor = vez) {
  const lista = [];
  for (let l = 0; l < N; l++)
    for (let c = 0; c < N; c++)
      if (t[l][c] === cor && jogadas(l, c, true, t, cor).length > 0) lista.push({ l, c });
  return lista;
}

/* ===== fim logica do jogo ===== */

/* ===== desenhar as peças ===== */

function desenhar() {
  for (let l = 0; l < N; l++) {
    for (let c = 0; c < N; c++) {
      const casa = casas[l][c];
      casa.classList.toggle('branca', tab[l][c] === 'B');
      casa.classList.toggle('preta',  tab[l][c] === 'P');
      casa.classList.toggle('selecionada',
        selecionada !== null && selecionada.l === l && selecionada.c === c);
      casa.classList.toggle('sopravel', sopraveis.some(p => p.l === l && p.c === c));
      casa.classList.remove('destino');
    }
  }

  // marcar os destinos possíveis da peça escolhida
  if (selecionada !== null) {
    for (const j of jogadas(selecionada.l, selecionada.c, emCaptura)) {
      casas[j.l][j.c].classList.add('destino');
    }
  }

  if (!fim) {
    estadoEl.textContent = 'Vez das ' + nomeCor(vez);
    if (emCaptura) {
      estadoEl.textContent += ' (clica na peça para terminar a jogada)';
    }
    if (sopraveis.length > 0) {
      estadoEl.textContent += ' (podes soprar uma peça marcada a vermelho)';
    }
  }
}

/* ===== fim desenho das peças ===== */

/* ===== matriz e inicio do jogo ===== */

function novoJogo() {
  tab = [
    ['P', 'P', 'P',  'P', 'P'],
    ['P', 'P', 'P',  'P', 'P'],
    ['P', 'P', null, 'B', 'B'],
    ['B', 'B', 'B',  'B', 'B'],
    ['B', 'B', 'B',  'B', 'B'],
  ];
  const comeca = document.querySelector('input[name="comeca"]:checked').value;
  vez = (comeca === 'brancas') ? 'B' : 'P';
  contraIA = document.querySelector('input[name="adversario"]:checked').value === 'ia';
  dificuldade = document.querySelector('input[name="dificuldade"]:checked').value;
  selecionada = null;
  emCaptura = false;
  fim = false;
  perguntaEl.hidden = true;
  penalizadas = [];
  sopraveis = [];
  desenhar();
  historico = {};
  posicaoRepetida();
  mostrarRanking();
  agendarIA();
}

document.getElementById('novo-jogo').addEventListener('click', () => {
  if (!fim && contraIA && vez === COR_IA) return; // espera a ia acabar
  novoJogo();
});
novoJogo();
document.getElementById('desistir').addEventListener('click', () => {
  if (fim) return;
  if (contraIA && vez === COR_IA) return;
  terminar('As ' + nomeCor(vez) + ' desistiram. Ganharam as ' + nomeCor(outraCor(vez)) + '!', outraCor(vez));
});
function mostrarPerguntaEmpate(quemPropoe) {
  textoEmpateEl.textContent = 'As ' + nomeCor(quemPropoe) + ' propõem empate. ' +
                              'As ' + nomeCor(outraCor(quemPropoe)) + ' aceitam?';
  perguntaEl.hidden = false;
}
document.getElementById('empate').addEventListener('click', () => {
  if (fim) return;
  if (contraIA) {
    estadoEl.textContent = 'A IA recusou o empate.';
    return;
  }
  mostrarPerguntaEmpate(vez);
});
document.getElementById('aceitar-empate').addEventListener('click', () => {
  terminar('Empate por acordo.', 'empate');
});
document.getElementById('recusar-empate').addEventListener('click', () => {
  perguntaEl.hidden = true;
});

/* ===== fim da matriz e inicio do jogo ===== */

/* ===== fim do jogo ===== */

function nomeCor(cor) {
  return (cor === 'B') ? 'brancas' : 'pretas';
}

function outraCor(cor) {
  return (cor === 'B') ? 'P' : 'B';
}

function terminar(mensagem, vencedor) {
  fim = true;
  selecionada = null;
  sopraveis = [];
  perguntaEl.hidden = true;
  estadoEl.textContent = mensagem;
  guardarResultado(vencedor);
  desenhar();
}

/* ===== funcoes para tabela ===== */

function jogador(cor) {
  if (contraIA && cor === COR_IA) return 'IA ' + dificuldade;
  return (cor === 'B') ? 'Brancas' : 'Pretas';
}

// soma 1 a um campo de um jogador; cria o jogador se ainda não existir
function somar(nome, campo) {
  if (!ranking[nome]) {
    ranking[nome] = { vitorias: 0, derrotas: 0, empates: 0 };
  }
  ranking[nome][campo]++;
}

function guardarResultado(vencedor) {
  if (vencedor === 'empate') {
    somar(jogador('B'), 'empates');
    somar(jogador('P'), 'empates');
  } else {
    somar(jogador(vencedor), 'vitorias');
    somar(jogador(outraCor(vencedor)), 'derrotas');
  }
  mostrarRanking();
}

function mostrarRanking() {
  const nomes = Object.keys(ranking);
  nomes.sort((a, b) => ranking[b].vitorias - ranking[a].vitorias); // ordena por vitorias

  tabelaRankingEl.innerHTML = ''; // limpa a tabela
  for (const nome of nomes) {
    const r = ranking[nome];
    const linha = document.createElement('tr');
    for (const texto of [nome, r.vitorias, r.derrotas, r.empates]) {
      const celula = document.createElement('td');
      celula.textContent = texto;
      linha.appendChild(celula);
    }
    tabelaRankingEl.appendChild(linha);
  }
}

/* ===== fim funcoes para tabela ===== */
function posicaoRepetida() {
  const chave = vez + JSON.stringify(tab);
  historico[chave] = (historico[chave] || 0) + 1;
  return historico[chave] >= REPETICOES;
}

/* ===== fim do jogo ===== */

/* ===== passar a vez durante jogada ===== */

function passarVez() {
  sopraveis = penalizadas;
  penalizadas = [];
  emCaptura = false;
  selecionada = null;
  vez = outraCor(vez);

  if (!temJogadas()) {
    terminar('Fim! Ganharam as ' + nomeCor(outraCor(vez)) + '!', outraCor(vez));
    return;
  }
  if (posicaoRepetida()) {
    terminar('Empate! O tabuleiro repetiu-se.', 'empate');
    return;
  }
  desenhar();
  agendarIA();
}

/* ===== fim passar a vez durante jogada ===== */

/* ===== implementa ia ===== */

function agendarIA() {
  if (!fim && contraIA && vez === COR_IA) {
    estadoEl.textContent = 'A IA está a pensar...';
    setTimeout(jogarIA, 500);
  }
}

function jogarIA() {
  if (fim || vez !== COR_IA) return;
  const jogada = escolherJogada(tab, vez, sopraveis, dificuldade);
  const r = aplicarJogada(tab, vez, jogada); // resultado final e penalizadas

  sopraveis = [];
  if (jogada.sopro) {
    tab[jogada.sopro.l][jogada.sopro.c] = null;   // 1) sopra
    desenhar();
    estadoEl.textContent = 'A IA soprou uma peça tua!';
    setTimeout(() => mostrarPasso(jogada, 1, r), 800); // 2) só depois joga
  } else {
    mostrarPasso(jogada, 1, r);
  }
}

// faz o passo i do caminho, desenha, e agenda o passo seguinte
function mostrarPasso(jogada, i, r) {
  const de   = jogada.caminho[i - 1];
  const para = jogada.caminho[i];
  tab[para.l][para.c] = vez;
  tab[de.l][de.c] = null;
  if (jogada.captura) {
    tab[(de.l + para.l) / 2][(de.c + para.c) / 2] = null; // tira a peça saltada
  }
  desenhar();

  if (i < jogada.caminho.length - 1) {
    setTimeout(() => mostrarPasso(jogada, i + 1, r), 600); // tempo de espera
  } else {
    penalizadas = r.penalizadas;
    passarVez();
  }
}

/* ===== fim implementa ia ===== */

/* ===== passo a passo dos cliques no tabuleiro ===== */

tabEl.addEventListener('click', (evento) => { // um eventlistener para todo tabuleiro, usa de bubbling para saber qual peca foi selecionada
  if (fim) return;

  if (contraIA && vez === COR_IA) return;
  
  const casa = evento.target.closest('.casa');
  if (!casa) return;

  const l = Number(casa.dataset.l);
  const c = Number(casa.dataset.c);

  if (!emCaptura && sopraveis.some(p => p.l === l && p.c === c)) {
    tab[l][c] = null; // retira a peca
    sopraveis = []; // soh se sopra uma
    desenhar();
    return;
  }

  // clicar na mesma peca durante captura, passa a vez
  if (emCaptura && l === selecionada.l && c === selecionada.c) {
    penalizadas = [{ l, c }];
    passarVez();
    return;
  }

  // nao se pode trocar de peca a meio de uma captura
  if (tab[l][c] === vez && !emCaptura) {
    selecionada = { l, c };
    desenhar();
    return;
  }

  // checa se o destino da peca eh valido
  if (selecionada === null) return;
  const jogada = jogadas(selecionada.l, selecionada.c, emCaptura)
                   .find(j => j.l === l && j.c === c);
  if (!jogada) return; // jogada invalida ignora o clique

  // quando peca podia capturar, penaliza
  if (!jogada.captura) {
    penalizadas = pecasComCaptura().map(p =>
      (p.l === selecionada.l && p.c === selecionada.c) ? { l, c } : p
    );
  }

  // mover a peça na matriz
  tab[l][c] = vez;
  tab[selecionada.l][selecionada.c] = null;

  // se foi captura, tira a peca comida e ve se pode continuar
  if (jogada.captura) {
    tab[jogada.captura.l][jogada.captura.c] = null;
    selecionada = { l, c };
    if (jogadas(l, c, true).length > 0) {
      emCaptura = true; // continua a mesma peça
      desenhar();
      return;
    }
  }

  passarVez();
});

/* ===== fim dos cliques no tabuleiro ===== */