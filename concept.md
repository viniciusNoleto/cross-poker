# Jogo de Cartas em Duplas (Baseado em Balatro)

## Objetivo

* O jogo é disputado por **4 jogadores**, divididos em **2 duplas**.
* Os jogadores da mesma dupla ficam sentados em posições opostas.
* A ordem dos turnos ocorre sempre no sentido horário, alternando entre as equipes.
* Vence a dupla que obtiver a maior pontuação ao final da partida.

---

# Componentes

* 1 baralho tradicional (52 cartas no total).
* Marcadores de pontuação.

---

# Estruturas do Jogo

## Monte

Pilha inicial contendo todas as cartas remanescentes após a distribuição.

## Bolo

Pilha de descarte do jogo.

Existem dois tipos de cartas no Bolo:

* **Cartas descartadas:** permanecem viradas para baixo.
* **Cartas jogadas em uma Mesa:** permanecem viradas para cima.

---

# Início da Partida

Cada jogador recebe:

* 8 cartas na mão;
* 5 Mesas;
* 5 Bolos.

O restante das cartas forma o Monte.

---

# Fluxo do Turno

No seu turno, o jogador pode realizar **uma** das seguintes ações:

* Utilizar uma Mesa;
* Utilizar um Bolo.

Caso o jogador não possua nenhuma ação disponível, ele é ignorado na ordem dos turnos.

---

# Mesa

Uma Mesa representa uma jogada de pontuação.

## Regras

* O jogador utiliza 1 Mesa.
* Pode jogar entre **1 e 5 cartas** da mão.
* O jogo identifica automaticamente a melhor combinação válida.
* Apenas as cartas que compõem essa combinação geram pontuação.
* As demais cartas jogadas não pontuam.
* Todas as cartas utilizadas na Mesa são enviadas ao Bolo com a face voltada para cima.
* Após a jogada, o jogador compra cartas até voltar para 8 cartas na mão.

## Compra após uma Mesa

Toda a compra deve ocorrer de apenas uma origem:

* Monte; **ou**
* Bolo.

Não é permitido misturar cartas das duas pilhas durante a mesma compra.

---

# Combinações

## Combinações de tamanho variável

* Carta Alta
* Par
* Dois Pares
* Trinca
* Quadra

## Combinações obrigatoriamente com 5 cartas

* Sequência (Straight)
* Flush
* Full House
* Straight Flush

---

# Pontuação

A pontuação segue o sistema do Balatro.

Para cada Mesa:

1. Soma-se o valor (Chips) das cartas que fazem parte da combinação válida.
2. Aplica-se o multiplicador correspondente à combinação.

As cartas jogadas que não fazem parte da combinação não geram pontos.

---

# Bolo

Um Bolo representa uma ação de gerenciamento da mão.

## Regras

* O jogador utiliza 1 Bolo.
* Pode descartar entre **1 e 5 cartas**.
* As cartas descartadas são colocadas no Bolo viradas para baixo.
* Em seguida compra a mesma quantidade de cartas.

## Compra após um Bolo

Toda a compra deve ocorrer de apenas uma origem:

* Monte; **ou**
* Bolo.

Não é permitido misturar cartas das duas pilhas durante a mesma compra.

---

# Troca de Equipe

Durante o turno, um jogador pode substituir uma ação de Bolo por uma Troca de Equipe.

## Regras

* O jogador declara quantas cartas deseja trocar (**1 a 5**).
* Ambos os parceiros devem possuir pelo menos 1 Bolo disponível.
* Ambos escolhem secretamente exatamente essa quantidade de cartas.
* As cartas são trocadas simultaneamente.
* O conteúdo da troca permanece secreto.
* Cada participante consome 1 Bolo.
* Nenhum jogador compra cartas após a troca.

---

# Compra de Cartas

Sempre que um jogador precisar comprar cartas:

* deve escolher apenas uma origem de compra;
* toda a compra será realizada do Monte **ou** do Bolo;
* não é permitido alternar entre as duas origens durante a mesma compra.

---

# Fim da Partida

A partida termina quando nenhum jogador possuir Mesas restantes.

A pontuação da dupla é a soma das pontuações de seus dois integrantes.

A dupla com a maior pontuação vence.

---

# Estrutura sugerida para implementação

## Entidades

### Carta

* Naipe
* Valor
* Chips

### Jogador

* Mão
* Mesas restantes
* Bolos restantes
* Pontuação
* Parceiro

### Equipe

* Jogadores
* Pontuação total

### Pilhas

* Monte
* Bolo

### Estado da partida

* Ordem dos jogadores
* Jogador atual
* Equipe vencedora
* Histórico de jogadas


## Mãos

| Mão            | Chips Base | Multiplicador |
| -------------- | ---------: | ------------: |
| Carta Alta     |          5 |            ×1 |
| Par            |         10 |            ×2 |
| Dois Pares     |         20 |            ×2 |
| Trinca         |         30 |            ×3 |
| Sequência      |         30 |            ×4 |
| Flush          |         35 |            ×4 |
| Full House     |         40 |            ×4 |
| Quadra         |         60 |            ×7 |
| Straight Flush |        100 |            ×8 |


## Chips por carta

| Carta  | Chips |
| ------ | ----: |
| Ás     |    11 |
| Rei    |    10 |
| Dama   |    10 |
| Valete |    10 |
| 10     |    10 |
| 9      |     9 |
| 8      |     8 |
| 7      |     7 |
| 6      |     6 |
| 5      |     5 |
| 4      |     4 |
| 3      |     3 |
| 2      |     2 |
