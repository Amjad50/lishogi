import { VNode, VNodeData, h, thunk } from 'snabbdom';
import * as enhance from './enhance';
import { Ctrl, Line } from './interfaces';
import { lineAction as modLineAction } from './moderation';
import { presetView } from './preset';
import * as spam from './spam';
import { userLink } from './util';
import { flag } from './xhr';

const whisperRegex = /^\/w(?:hisper)?\s/;

export default function (ctrl: Ctrl): Array<VNode | undefined> {
  if (!ctrl.vm.enabled) return [];
  const scrollCb = (vnode: VNode) => {
      const el = vnode.elm as HTMLElement;
      if (ctrl.data.lines.length > 5) {
        const autoScroll = el.scrollTop === 0 || el.scrollTop > el.scrollHeight - el.clientHeight - 100;
        if (autoScroll) {
          el.scrollTop = 999999;
          setTimeout((_: any) => (el.scrollTop = 999999), 300);
        }
      }
    },
    mod = ctrl.moderation();
  const vnodes = [
    h(
      'ol.mchat__messages.chat-v-' + ctrl.data.domVersion,
      {
        attrs: {
          role: 'log',
          'aria-live': 'polite',
          'aria-atomic': 'false',
        },
        hook: {
          insert(vnode) {
            const $el = $(vnode.elm as HTMLElement).on('click', 'a.jump', (e: Event) => {
              window.lishogi.pubsub.emit('jump', (e.target as HTMLElement).getAttribute('data-ply'));
            });
            if (mod)
              $el.on('click', '.mod', (e: Event) => mod.open((e.target as HTMLElement).parentNode as HTMLElement));
            else
              $el.on('click', '.flag', (e: Event) => report(ctrl, (e.target as HTMLElement).parentNode as HTMLElement));
            scrollCb(vnode);
          },
          postpatch: (_, vnode) => scrollCb(vnode),
        },
      },
      selectLines(ctrl).map(line => renderLine(ctrl, line))
    ),
    renderInput(ctrl),
  ];
  const presets = presetView(ctrl.preset);
  if (presets) vnodes.push(presets);
  return vnodes;
}

function renderInput(ctrl: Ctrl): VNode | undefined {
  if (!ctrl.vm.writeable) return;
  if ((ctrl.data.loginRequired && !ctrl.data.userId) || ctrl.data.restricted)
    return h('input.mchat__say', {
      attrs: {
        placeholder: ctrl.trans('loginToChat'),
        disabled: true,
      },
    });
  let placeholder: string;
  if (ctrl.vm.timeout) placeholder = ctrl.trans('youHaveBeenTimedOut');
  else if (ctrl.opts.blind) placeholder = 'Chat';
  else placeholder = ctrl.trans.noarg(ctrl.vm.placeholderKey);
  return h('input.mchat__say', {
    attrs: {
      placeholder,
      autocomplete: 'off',
      maxlength: 140,
      disabled: ctrl.vm.timeout || !ctrl.vm.writeable,
    },
    hook: {
      insert(vnode) {
        setupHooks(ctrl, vnode.elm as HTMLInputElement);
      },
    },
  });
}

let mouchListener: EventListener;

const setupHooks = (ctrl: Ctrl, chatEl: HTMLInputElement) => {
  const storage = window.lishogi.tempStorage.make('chatInput');
  if (storage.get()) {
    chatEl.value = storage.get()!;
    storage.remove();
    chatEl.focus();
  }

  chatEl.addEventListener('keypress', (e: KeyboardEvent) =>
    setTimeout(() => {
      const el = e.target as HTMLInputElement,
        txt = el.value,
        pub = ctrl.opts.public;
      storage.set(el.value);
      if (e.which == 10 || e.which == 13) {
        if (txt === '') $('.keyboard-move input').focus();
        else {
          spam.report(txt);
          if (pub && spam.hasTeamUrl(txt)) alert("Please don't advertise teams in the chat.");
          else ctrl.post(txt);
          el.value = '';
          storage.remove();
          if (!pub) el.classList.remove('whisper');
        }
      } else {
        el.removeAttribute('placeholder');
        if (!pub) el.classList.toggle('whisper', !!txt.match(whisperRegex));
      }
    })
  );

  window.Mousetrap.bind('c', () => {
    chatEl.focus();
    return false;
  });

  window.Mousetrap(chatEl).bind('esc', () => chatEl.blur());

  // Ensure clicks remove chat focus.
  // See lichess-org/chessground#109

  const mouchEvents = ['touchstart', 'mousedown'];

  if (mouchListener)
    mouchEvents.forEach(event => document.body.removeEventListener(event, mouchListener, { capture: true }));

  mouchListener = (e: MouseEvent) => {
    if (!e.shiftKey && e.buttons !== 2 && e.button !== 2) chatEl.blur();
  };

  chatEl.onfocus = () =>
    mouchEvents.forEach(event =>
      document.body.addEventListener(event, mouchListener, {
        passive: true,
        capture: true,
      })
    );

  chatEl.onblur = () =>
    mouchEvents.forEach(event => document.body.removeEventListener(event, mouchListener, { capture: true }));
};

function sameLines(l1: Line, l2: Line) {
  return l1.d && l2.d && l1.u === l2.u;
}

function selectLines(ctrl: Ctrl): Array<Line> {
  let prev: Line,
    ls: Array<Line> = [];
  ctrl.data.lines.forEach(line => {
    if (
      !line.d &&
      (!prev || !sameLines(prev, line)) &&
      (!line.r || (line.u || '').toLowerCase() == ctrl.data.userId) &&
      !spam.skip(line.t)
    )
      ls.push(line);
    prev = line;
  });
  return ls;
}

function updateText(parseMoves: boolean, system: boolean) {
  return (oldVnode: VNode, vnode: VNode) => {
    if ((vnode.data as VNodeData).lishogiChat !== (oldVnode.data as VNodeData).lishogiChat) {
      const elm = vnode.elm as HTMLElement,
        fullText = (vnode.data as VNodeData).lishogiChat,
        parsed = system ? separateTitleAndText(fullText) : ['', fullText];

      if (parsed[0]) elm.setAttribute('title', parsed[0]);
      elm.innerHTML = enhance.enhance(parsed[1], parseMoves);
    }
  };
}

function separateTitleAndText(text: string): [string, string] {
  if (enhance.possibleTitlePattern.test(text)) {
    const match = /^\[(.*?)\](.*)/.exec(text)!;

    return [match[1], match[2]];
  } else return ['', text];
}

function renderText(t: string, parseMoves: boolean, system: boolean) {
  if (enhance.isMoreThanText(t, system)) {
    const hook = updateText(parseMoves, system);
    return h('t', {
      lishogiChat: t,
      hook: {
        create: hook,
        update: hook,
      },
    });
  }
  return h('t', t);
}

function report(ctrl: Ctrl, line: HTMLElement) {
  const userA = line.querySelector('a.user-link') as HTMLLinkElement;
  const text = (line.querySelector('t') as HTMLElement).innerText;
  if (userA && confirm(`Report "${text}" to moderators?`)) flag(ctrl.data.resourceId, userA.href.split('/')[4], text);
}

function renderLine(ctrl: Ctrl, line: Line) {
  const system = line.u === 'lishogi',
    textNode = renderText(line.t, ctrl.opts.parseMoves, system);

  if (system) return h('li.system', textNode);

  if (line.c) return h('li', [h('span.color', '[' + line.c + ']'), textNode]);

  const userNode = thunk('a', line.u, userLink, [line.u, line.title]);

  return h(
    'li',
    ctrl.moderation()
      ? [line.u ? modLineAction() : null, userNode, textNode]
      : [
          ctrl.data.userId && line.u && ctrl.data.userId != line.u
            ? h('i.flag', {
                attrs: {
                  'data-icon': '!',
                  title: 'Report',
                },
              })
            : null,
          userNode,
          textNode,
        ]
  );
}
