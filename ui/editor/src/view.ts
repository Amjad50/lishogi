import { h } from 'snabbdom';
import { VNode } from 'snabbdom/vnode';
import { MouchEvent, NumberPair, Role } from 'shogiground/types';
import { dragNewPiece } from 'shogiground/drag';
import { eventPosition, opposite } from 'shogiground/util';

import EditorCtrl from './ctrl';
import shogiground from './shogiground';
import { OpeningPosition, Selected, EditorState } from './interfaces';
import { parseFen } from 'shogiops/fen';
import { defined } from 'shogiops/util';
import { handRoles } from 'shogiops/variantUtil';

type Position = 'top' | 'bottom';

function pocket(ctrl: EditorCtrl, c: Color, p: Position): VNode {
  return h(
    `div.e-pocket.e-pocket-${p}.${c}`,
    {},
    handRoles('shogi')
      .reverse()
      .map(r => {
        const nb = ctrl.hands[c][r as Role];
        const delta = 10;

        // Distinguishing between click with small movement and drag
        // mousedown/touchstart hasn't turned into drag
        let isActive: boolean = false;
        // Click starting position, leaving this by delat turns it into drag
        let startX: number;
        let startY: number;

        return h(
          'div.no-square',
          {
            on: {
              mousedown: e => {
                startX = e.pageX;
                startY = e.pageY;
                isActive = true;

                e.preventDefault();
              },
              touchstart: e => {
                startX = e.touches[0].pageX;
                startY = e.touches[0].pageY;
                isActive = true;

                e.preventDefault();
              },
              mousemove: e => {
                if (!isActive) return;
                const diffX = Math.abs(e.pageX - startX);
                const diffY = Math.abs(e.pageY - startY);
                if (diffX >= delta || diffY >= delta) {
                  dragFromPocket(ctrl, [c, r as Role], nb, 'mouseup')(e as MouchEvent);
                  isActive = false;
                }
              },
              touchmove: e => {
                lastTouchMovePos = eventPosition(e as any);
                if (!isActive || !lastTouchMovePos) return;
                const diffX = Math.abs(lastTouchMovePos[0] - startX);
                const diffY = Math.abs(lastTouchMovePos[1] - startY);
                if (diffX >= delta || diffY >= delta) {
                  dragFromPocket(ctrl, [c, r as Role], nb, 'touchend')(e as MouchEvent);
                  isActive = false;
                }
              },
              mouseup: e => {
                if (isActive) {
                  if (e.shiftKey || ctrl.selected() === 'trash') ctrl.removeFromPocket(c, r as Role, true);
                  else ctrl.addToPocket(c, r as Role, true);
                }
                isActive = false;

                e.preventDefault();
              },
              touchend: e => {
                if (isActive) {
                  if (ctrl.selected() === 'trash') ctrl.removeFromPocket(c, r as Role, true);
                  else ctrl.addToPocket(c, r as Role, true);
                }
                isActive = false;

                e.preventDefault();
              },
              contextmenu: e => {
                ctrl.removeFromPocket(c, r as Role, true);

                e.preventDefault();
              },
            },
          },
          [
            h(
              'div',
              h(
                'piece',
                {
                  attrs: {
                    class: c + ' ' + r,
                    'data-role': r,
                    'data-color': c,
                    'data-nb': nb,
                  },
                },
                []
              )
            ),
          ]
        );
      })
  );
}

function dragFromPocket(ctrl: EditorCtrl, s: Selected, nb: number, upEvent: string): (e: MouchEvent) => void {
  return function (e: MouchEvent): void {
    e.preventDefault();
    if (s !== 'pointer' && s !== 'trash' && nb > 0) {
      ctrl.removeFromPocket(s[0], s[1], true);
      dragNewPiece(
        ctrl.shogiground!.state,
        {
          color: s[0],
          role: s[1],
        },
        e,
        true
      );
      document.addEventListener(
        upEvent,
        (e: MouchEvent) => {
          const eventPos = eventPosition(e) || lastTouchMovePos;
          if (eventPos) {
            if (ctrl.shogiground!.getKeyAtDomPos(eventPos)) ctrl.selected('pointer');

            const pocketTarget = insideWhichPocket(eventPos);
            if (pocketTarget === 'sente') ctrl.addToPocket('sente', s[1], true);
            else if (pocketTarget === 'gote') ctrl.addToPocket('gote', s[1], true);
          }
          ctrl.redraw();
        },
        { once: true }
      );
    }
  };
}

function insideWhichPocket(eventPos: NumberPair): Color | undefined {
  const sente = document.getElementsByClassName('e-pocket sente')[0];
  if (sente) {
    const rectSente = sente.getBoundingClientRect();
    if (
      eventPos[0] >= rectSente.left &&
      eventPos[0] <= rectSente.right &&
      eventPos[1] >= rectSente.top &&
      eventPos[1] <= rectSente.bottom
    )
      return 'sente';
  }
  const gote = document.getElementsByClassName('e-pocket gote')[0];
  if (gote) {
    const rectGote = gote.getBoundingClientRect();
    if (
      eventPos[0] >= rectGote.left &&
      eventPos[0] <= rectGote.right &&
      eventPos[1] >= rectGote.top &&
      eventPos[1] <= rectGote.bottom
    )
      return 'gote';
  }
  return undefined;
}

function pieceCounter(ctrl: EditorCtrl): VNode {
  function singlePieceCounter(cur: number, total: number, name: string, suffix: string = ''): VNode {
    return h('span', [`${cur.toString()}/${total.toString()}`, h('strong', ` ${name}`), `${suffix}`]);
  }
  return h('div.piece-counter', {}, [
    h('div.piece-count', [
      singlePieceCounter(ctrl.countPieces('pawn'), 18, '歩(P)', ', '),
      singlePieceCounter(ctrl.countPieces('lance'), 4, '香(L)', ', '),
      singlePieceCounter(ctrl.countPieces('knight'), 4, '桂(N)', ', '),
      singlePieceCounter(ctrl.countPieces('silver'), 4, '銀(S)', ', '),
      singlePieceCounter(ctrl.countPieces('gold'), 4, '金(G)', ', '),
      singlePieceCounter(ctrl.countPieces('bishop'), 2, '角(B)', ', '),
      singlePieceCounter(ctrl.countPieces('rook'), 2, '飛(R)', ', '),
      singlePieceCounter(ctrl.countPieces('king'), 2, '玉(K)'),
    ]),
  ]);
}

function optgroup(name: string, opts: VNode[]): VNode {
  return h('optgroup', { attrs: { label: name } }, opts);
}

function studyButton(ctrl: EditorCtrl, state: EditorState): VNode {
  return h(
    'form',
    {
      attrs: {
        method: 'post',
        action: '/study/as',
      },
    },
    [
      h('input', {
        attrs: {
          type: 'hidden',
          name: 'orientation',
          value: ctrl.bottomColor(),
        },
      }),
      h('input', {
        attrs: { type: 'hidden', name: 'variant', value: ctrl.rules },
      }),
      h('input', {
        attrs: { type: 'hidden', name: 'fen', value: state.legalFen || '' },
      }),
      h(
        'button',
        {
          attrs: {
            type: 'submit',
            'data-icon': '4',
            disabled: !state.legalFen,
          },
          class: {
            button: true,
            'button-empty': true,
            text: true,
            disabled: !state.legalFen,
          },
        },
        ctrl.trans.noarg('toStudy')
      ),
    ]
  );
}

function controls(ctrl: EditorCtrl, state: EditorState): VNode {
  const position2option = function (pos: OpeningPosition): VNode {
    return h(
      'option',
      {
        attrs: {
          value: pos.epd || pos.fen,
          'data-fen': pos.fen,
        },
      },
      pos.eco ? `${pos.eco} ${pos.name}` : pos.name
    );
  };
  return h('div.board-editor__tools', [
    ...(ctrl.cfg.embed || !ctrl.cfg.positions
      ? []
      : [
          h('div', [
            h(
              'select.positions',
              {
                props: {
                  value: state.fen.split(' ').slice(0, 4).join(' '),
                },
                on: {
                  change(e) {
                    const el = e.target as HTMLSelectElement;
                    let value = el.selectedOptions[0].getAttribute('data-fen');
                    if (value == 'prompt') value = (prompt('Paste SFEN') || '').trim();
                    if (!value || !ctrl.setFen(value)) el.value = '';
                  },
                },
              },
              [
                optgroup(ctrl.trans.noarg('setTheBoard'), [
                  h(
                    'option',
                    {
                      attrs: {
                        selected: true,
                      },
                    },
                    `- ${ctrl.trans.noarg('boardEditor')}  -`
                  ),
                  ...ctrl.extraPositions.map(position2option),
                ]),
                optgroup('Handicaps', ctrl.cfg.positions.map(position2option)),
              ]
            ),
          ]),
        ]),
    h('div.metadata', [
      h(
        'div.color',
        h(
          'select',
          {
            on: {
              change(e) {
                ctrl.setTurn((e.target as HTMLSelectElement).value as Color);
              },
            },
          },
          ['blackPlays', 'whitePlays'].map(function (key) {
            return h(
              'option',
              {
                attrs: {
                  value: key[0] == 'b' ? 'sente' : 'gote',
                  selected: (ctrl.turn === 'sente' ? 'b' : 'w') === key[0],
                },
              },
              ctrl.trans(key)
            );
          })
        )
      ),
      ctrl.cfg.embed ? '' : pieceCounter(ctrl),
    ]),
    ...(ctrl.cfg.embed
      ? [
          h('div.actions', [
            h(
              'a.button.button-empty',
              {
                on: {
                  click() {
                    ctrl.startPosition();
                  },
                },
              },
              ctrl.trans.noarg('startPosition')
            ),
            h(
              'a.button.button-empty',
              {
                on: {
                  click() {
                    ctrl.clearBoard();
                  },
                },
              },
              ctrl.trans.noarg('clearBoard')
            ),
            h(
              'a.button.button-empty',
              {
                class: {
                  disabled: !ctrl.canFillGoteHand(),
                },
                on: {
                  click() {
                    ctrl.fillGotesHand();
                  },
                },
              },
              ctrl.trans.noarg('fillGotesHand')
            ),
          ]),
        ]
      : [
          h('div.actions', [
            h(
              'a.button.button-empty.text',
              {
                attrs: { 'data-icon': 'q' },
                on: {
                  click() {
                    ctrl.clearBoard();
                  },
                },
              },
              ctrl.trans.noarg('clearBoard')
            ),
            h(
              'a.button.button-empty.text',
              {
                attrs: { 'data-icon': 'N' },
                class: {
                  disabled: !ctrl.canFillGoteHand(),
                },
                on: {
                  click() {
                    ctrl.fillGotesHand();
                  },
                },
              },
              ctrl.trans.noarg('fillGotesHand')
            ),
            h(
              'a.button.button-empty.text',
              {
                attrs: { 'data-icon': 'B' },
                on: {
                  click() {
                    ctrl.setOrientation(opposite(ctrl.shogiground!.state.orientation));
                  },
                },
              },
              ctrl.trans.noarg('flipBoard')
            ),
            h(
              'a',
              {
                attrs: {
                  'data-icon': 'A',
                  rel: 'nofollow',
                  ...(state.legalFen ? { href: ctrl.makeAnalysisUrl(state.legalFen) } : {}),
                },
                class: {
                  button: true,
                  'button-empty': true,
                  text: true,
                  disabled: !state.legalFen,
                },
              },
              ctrl.trans.noarg('analysis')
            ),
            h(
              'a',
              {
                class: {
                  button: true,
                  'button-empty': true,
                  disabled: !state.playable,
                },
                on: {
                  click: () => {
                    if (state.playable) $.modal($('.continue-with'));
                  },
                },
              },
              [h('span.text', { attrs: { 'data-icon': 'U' } }, ctrl.trans.noarg('continueFromHere'))]
            ),
            studyButton(ctrl, state),
          ]),
          h('div.continue-with.none', [
            h(
              'a.button',
              {
                attrs: {
                  href: '/?fen=' + ctrl.encodeFen(state.legalFen || '') + '#ai',
                  rel: 'nofollow',
                },
              },
              ctrl.trans.noarg('playWithTheMachine')
            ),
            h(
              'a.button',
              {
                attrs: {
                  href: '/?fen=' + ctrl.encodeFen(state.legalFen || '') + '#friend',
                  rel: 'nofollow',
                },
              },
              ctrl.trans.noarg('playWithAFriend')
            ),
          ]),
        ]),
  ]);
}

function inputs(ctrl: EditorCtrl, fen: string): VNode | undefined {
  if (ctrl.cfg.embed) return;
  return h('div.copyables', [
    h('p', [
      h('strong', 'SFEN'),
      h('input.copyable', {
        attrs: {
          spellcheck: false,
        },
        props: {
          value: fen,
        },
        on: {
          change(e) {
            const el = e.target as HTMLInputElement;
            ctrl.setFen(el.value.trim());
            el.reportValidity();
          },
          input(e) {
            const el = e.target as HTMLInputElement;
            const valid = parseFen(el.value.trim()).isOk;
            el.setCustomValidity(valid ? '' : 'Invalid SFEN');
          },
          blur(e) {
            const el = e.target as HTMLInputElement;
            el.value = ctrl.getFen();
            el.setCustomValidity('');
          },
        },
      }),
    ]),
    h('p', [
      h('strong.name', 'URL '), // en space
      h('input.copyable.autoselect', {
        attrs: {
          readonly: true,
          spellcheck: false,
          value: ctrl.makeUrl(ctrl.cfg.baseUrl, fen),
        },
      }),
    ]),
  ]);
}

// can be 'pointer', 'trash', or [color, role]
function selectedToClass(s: Selected): string {
  return s === 'pointer' || s === 'trash' ? s : s.join(' ');
}

let lastTouchMovePos: NumberPair | undefined;

function sparePieces(ctrl: EditorCtrl, color: Color, _orientation: Color, position: 'top' | 'bottom'): VNode {
  const selectedClass = selectedToClass(ctrl.selected());

  const pieces = [
    'king',
    'rook',
    'bishop',
    'gold',
    'silver',
    'knight',
    'lance',
    'pawn',
    'dragon',
    'horse',
    'promotedsilver',
    'promotedknight',
    'promotedlance',
    'tokin',
  ].map(function (role) {
    return [color, role];
  });

  return h(
    'div',
    {
      attrs: {
        class: ['spare', 'spare-' + position, 'spare-' + color].join(' '),
      },
    },
    [...pieces, 'trash', 'pointer'].map((s: Selected) => {
      const className = selectedToClass(s);
      const attrs = {
        class: className,
        ...(s !== 'pointer' && s !== 'trash'
          ? {
              'data-color': s[0],
              'data-role': s[1],
            }
          : {}),
      };
      const selectedSquare =
        selectedClass === className &&
        (!ctrl.shogiground ||
          !ctrl.shogiground.state.draggable.current ||
          !ctrl.shogiground.state.draggable.current.newPiece);
      return h(
        'div',
        {
          class: {
            'no-square': true,
            pointer: s === 'pointer',
            trash: s === 'trash',
            'selected-square': selectedSquare,
          },
          on: {
            mousedown: onSelectSparePiece(ctrl, s, 'mouseup'),
            touchstart: onSelectSparePiece(ctrl, s, 'touchend'),
            touchmove: e => {
              lastTouchMovePos = eventPosition(e as any);
            },
          },
        },
        [h('div', [h('piece', { attrs })])]
      );
    })
  );
}

function onSelectSparePiece(ctrl: EditorCtrl, s: Selected, upEvent: string): (e: MouchEvent) => void {
  return function (e: MouchEvent): void {
    e.preventDefault();
    if (s === 'pointer' || s === 'trash') {
      ctrl.selected(s);
      ctrl.redraw();
    } else {
      ctrl.selected('pointer');

      dragNewPiece(
        ctrl.shogiground!.state,
        {
          color: s[0],
          role: s[1],
        },
        e,
        true
      );

      document.addEventListener(
        upEvent,
        (e: MouchEvent) => {
          const eventPos = eventPosition(e) || lastTouchMovePos;
          if (eventPos) {
            const pocketTarget = insideWhichPocket(eventPos);
            if (pocketTarget === 'sente') ctrl.addToPocket('sente', s[1], true);
            else if (pocketTarget === 'gote') ctrl.addToPocket('gote', s[1], true);

            // set selected only when upevent occurs outside of the board and the pocket
            if (!defined(pocketTarget) && !defined(ctrl.shogiground!.getKeyAtDomPos(eventPos))) ctrl.selected(s);
          }
          ctrl.redraw();
        },
        { once: true }
      );
    }
  };
}

export default function (ctrl: EditorCtrl): VNode {
  const state = ctrl.getState();
  const color = ctrl.bottomColor();

  return h('div.board-editor', [
    sparePieces(ctrl, opposite(color), color, 'top'),
    pocket(ctrl, opposite(color), 'top'),
    h('div.main-board', [shogiground(ctrl)]),
    pocket(ctrl, color, 'bottom'),
    sparePieces(ctrl, color, color, 'bottom'),
    controls(ctrl, state),
    inputs(ctrl, state.fen),
  ]);
}
