// copia tabuleiro
function copiar(t) {
  return t.map(linha => linha.slice());
}

// exemplo jogada completa da IA:
// { sopro: {l,c} ou null, caminho: [{l,c}, {l,c}, ...], captura: true/false }
// caminho[0] é onde a peça está; os seguintes são onde vai parando

// junta à lista todas as capturas (simples e múltiplas) a partir do fim do caminho
function cadeias(t, cor, caminho, sopro, lista) {
  const atual = caminho[caminho.length - 1];
  for (const j of jogadas(atual.l, atual.c, true, t, cor)) {
    const novo = copiar(t);
    novo[j.l][j.c] = cor;
    novo[atual.l][atual.c] = null;
    novo[j.captura.l][j.captura.c] = null;

    const novoCaminho = caminho.concat([{ l: j.l, c: j.c }]);
    lista.push({ sopro: sopro, caminho: novoCaminho, captura: true }); // parar aqui
    cadeias(novo, cor, novoCaminho, sopro, lista); // ou continuar a captura em cadeia
  }
}

function todasJogadas(t, cor, sopraveis) {
  const lista = [];
  const opcoesSopro = [null].concat(sopraveis); // nao soprar ou soprar

  for (const sopro of opcoesSopro) {
    const tt = copiar(t);
    if (sopro) tt[sopro.l][sopro.c] = null;

    for (let l = 0; l < N; l++) {
      for (let c = 0; c < N; c++) {
        if (tt[l][c] !== cor) continue;
        // movimentos simples
        for (const j of jogadas(l, c, false, tt, cor)) {
          if (!j.captura) {
            lista.push({ sopro: sopro, caminho: [{ l, c }, { l: j.l, c: j.c }], captura: false });
          }
        }
        // capturas
        cadeias(tt, cor, [{ l, c }], sopro, lista);
      }
    }
  }
  return lista;
}

// aplica uma jogada completa a copia do tabuleiro
// devolve o tabuleiro novo e as peças que ficam penalizadas
function aplicarJogada(t, cor, jogada) {
  const novo = copiar(t);
  if (jogada.sopro) novo[jogada.sopro.l][jogada.sopro.c] = null;

  const caminho = jogada.caminho;
  const origem  = caminho[0];
  const destino = caminho[caminho.length - 1];
  let penalizadas = [];

  // movimento simples quando alguma peça podia capturar => penalizadas
  if (!jogada.captura) {
    penalizadas = pecasComCaptura(novo, cor).map(p =>
      (p.l === origem.l && p.c === origem.c) ? destino : p
    );
  }

  // mover a peça, passo a passo
  for (let i = 1; i < caminho.length; i++) {
    const de = caminho[i - 1];
    const para = caminho[i];
    novo[para.l][para.c] = cor;
    novo[de.l][de.c] = null;
    if (jogada.captura) {
      novo[(de.l + para.l) / 2][(de.c + para.c) / 2] = null; // a peça saltada fica entre as duas
    }
  }

  // parou a captura quando ainda podia continuar => penalizada
  if (jogada.captura && jogadas(destino.l, destino.c, true, novo, cor).length > 0) {
    penalizadas = [destino];
  }

  return { tab: novo, penalizadas: penalizadas };
}

// pontuação de um tabuleiro (numeor de pecas vs do advesario)
function avaliar(t, cor) {
  let pontos = 0;
  for (let l = 0; l < N; l++) {
    for (let c = 0; c < N; c++) {
      if (t[l][c] === cor) pontos++;
      else if (t[l][c] === outraCor(cor)) pontos--;
    }
  }
  return pontos;
}

// minimax, profundidade gera custo
function minimax(t, cor, sopraveis, profundidade, corIA) {
  if (profundidade === 0) return avaliar(t, corIA);

  const lista = todasJogadas(t, cor, sopraveis);
  if (lista.length === 0) {
    return (cor === corIA) ? -1000 : 1000; // quem não tem jogadas perde
  }

  // a IA quer o valor mais alto e o adversario o mais baixo
  let melhor = (cor === corIA) ? -Infinity : Infinity;
  for (const j of lista) {
    const r = aplicarJogada(t, cor, j);
    const valor = minimax(r.tab, outraCor(cor), r.penalizadas, profundidade - 1, corIA);
    if (cor === corIA) melhor = Math.max(melhor, valor);
    else               melhor = Math.min(melhor, valor);
  }
  return melhor;
}

function aleatoria(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// escolhe a jogada da IA conforme a dificuldade
function escolherJogada(t, cor, sopraveis, dificuldade) {
  const lista = todasJogadas(t, cor, sopraveis);

  if (dificuldade === 'facil') return aleatoria(lista);
  if (dificuldade === 'medio' && Math.random() < 0.5) return aleatoria(lista);

  const profundidade = (dificuldade === 'medio') ? 2 : 3;
  let melhor = lista[0];
  let melhorValor = -Infinity;
  for (const j of lista) {
    const r = aplicarJogada(t, cor, j);
    const valor = minimax(r.tab, outraCor(cor), r.penalizadas, profundidade - 1, cor);
    if (valor > melhorValor) {
      melhorValor = valor;
      melhor = j;
    }
  }
  return melhor;
}