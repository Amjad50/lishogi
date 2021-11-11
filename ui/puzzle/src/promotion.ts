import { h } from 'snabbdom';
import { bind, onInsert } from './util';
import { Api as CgApi } from 'shogiground/api';
import * as cgUtil from 'shogiground/util';
import { Role } from 'shogiground/types';
import { MaybeVNode, Vm, Redraw, Promotion } from './interfaces';
import { defined, Prop } from 'common';
import { parseChessSquare } from 'shogiops/compat';
import { pieceCanPromote, promote as shogiopsPromote } from 'shogiops/variantUtil';

export default function (vm: Vm, getGround: Prop<CgApi>, redraw: Redraw): Promotion {
  let promoting: any = false;

  function start(orig: Key, dest: Key, callback: (orig: Key, key: Key, prom?: Boolean) => void) {
    const g = getGround(),
      piece = g.state.pieces.get(dest);
    if (!defined(piece)) return false;
    if (pieceCanPromote('shogi')(piece, parseChessSquare(orig)!, parseChessSquare(dest)!)) {
      promoting = {
        orig: orig,
        dest: dest,
        role: piece.role,
        callback: callback,
      };
      redraw();
      return true;
    }
    return false;
  }

  function promote(g: CgApi, key: Key, role: Role): void {
    const piece = g.state.pieces.get(key);
    if (piece && ['pawn', 'lance', 'knight', 'silver', 'bishop', 'rook'].includes(piece.role)) {
      g.setPieces(
        new Map([
          [
            key,
            {
              color: piece.color,
              role,
            },
          ],
        ])
      );
    }
  }

  function finish(role: Role): void {
    const promoted = !['pawn', 'lance', 'knight', 'silver', 'bishop', 'rook'].includes(role);
    if (promoting && promoted) promote(getGround(), promoting.dest, role);
    if (promoting && promoting.callback) promoting.callback(promoting.orig, promoting.dest, promoted);
    promoting = false;
  }

  function cancel(): void {
    if (promoting) {
      promoting = false;
      getGround().set(vm.cgConfig);
      redraw();
    }
  }

  function renderPromotion(dest: Key, pieces: Role[], color: Color, orientation: Color): MaybeVNode {
    if (!promoting) return;

    let left = (8 - cgUtil.key2pos(dest)[0]) * (100 / 9);
    if (orientation === 'sente') left = cgUtil.key2pos(dest)[0] * (100 / 9);
    const vertical = color === orientation ? 'top' : 'bottom';

    return h(
      'div#promotion-choice.' + vertical,
      {
        hook: onInsert(el => {
          el.addEventListener('click', cancel);
          el.oncontextmenu = () => false;
        }),
      },
      pieces.map(function (serverRole, i) {
        let top = (i + cgUtil.key2pos(dest)[1]) * (100 / 9);
        if (orientation === 'sente') top = (9 - (i + cgUtil.key2pos(dest)[1])) * (100 / 9);
        return h(
          'square',
          {
            attrs: {
              style: 'top: ' + top + '%;left: ' + left + '%',
            },
            hook: bind('click', e => {
              e.stopPropagation();
              finish(serverRole);
            }),
          },
          [h('piece.' + serverRole + '.' + color)]
        );
      })
    );
  }

  return {
    start,
    cancel,
    view() {
      if (!promoting) return;

      const pieces: Role[] =
        getGround().state.turnColor === 'sente'
          ? [shogiopsPromote('shogi')(promoting.role), promoting.role]
          : [promoting.role, shogiopsPromote('shogi')(promoting.role)];

      return renderPromotion(
        promoting.dest,
        pieces,
        cgUtil.opposite(getGround().state.turnColor),
        getGround().state.orientation
      );
    },
  };
}
