/* ================================================================
   DS PLAYGROUND — shared render engine + 7 structure modules
   ================================================================ */
const delay = ms => new Promise(r=>setTimeout(r,ms));
let GEN = 0;

/* ---------- lightweight syntax highlighter ---------- */
function highlight(src, lang){
  const cppKw = ['class','struct','public','private','void','int','bool','string','return','if','else','while','for','new','delete','nullptr','true','false','const','auto','using','namespace','template','typename','vector','static','break','continue','this','std','map','queue','stack','pair'];
  const pyKw = ['def','class','self','return','if','elif','else','while','for','in','None','True','False','import','from','not','and','or','is','pass','break','continue','yield'];
  const kw = lang==='cpp'?cppKw:pyKw;
  const esc = src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const commentPattern = lang==='cpp' ? '//.*' : '#.*';
  const stringPattern = `"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'`;
  const re = new RegExp(`(${commentPattern})|(${stringPattern})|\\b(${kw.join('|')})\\b`, 'g');
  return esc.replace(re, (m, cm, st, kwm)=>{
    if(cm) return `<span class="cm">${cm}</span>`;
    if(st) return `<span class="st">${st}</span>`;
    if(kwm) return `<span class="kw">${kwm}</span>`;
    return m;
  });
}

/* ---------- generic node/edge stage renderer ---------- */
class Stage{
  constructor(inner, svg){
    this.inner = inner; this.svg = svg; this.map = new Map();
    svg.innerHTML = `<defs><marker id="arrowhead" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" class="arrowhead"></path></marker></defs>`;
  }
  sync(nodes, edges){
    const seen = new Set();
    nodes.forEach(n=>{
      seen.add(n.id);
      let rec = this.map.get(n.id);
      if(!rec){
        const el = document.createElement('div');
        el.className = 'node enter '+(n.cls||'');
        el.style.left = n.x+'px'; el.style.top = n.y+'px';
        el.style.width=(n.w||46)+'px'; el.style.height=(n.h||46)+'px';
        el.innerHTML = n.label;
        if(n.sub){
          const b = document.createElement('div');
          b.className='node-idx'; b.textContent = n.sub;
          el.appendChild(b);
        }
        this.inner.appendChild(el);
        rec = {el}; this.map.set(n.id, rec);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(el.isConnected) el.classList.remove('enter'); }));
      } else {
        rec.el.className = 'node '+(n.cls||'');
        rec.el.style.left = n.x+'px'; rec.el.style.top = n.y+'px';
        rec.el.style.width=(n.w||46)+'px'; rec.el.style.height=(n.h||46)+'px';
        rec.el.innerHTML = n.label;
        if(n.sub){
          const b = document.createElement('div');
          b.className='node-idx'; b.textContent = n.sub;
          rec.el.appendChild(b);
        }
      }
    });
    for(const [id, rec] of [...this.map]){
      if(!seen.has(id)){
        rec.el.classList.add('leave');
        setTimeout(()=>rec.el.remove(), 380);
        this.map.delete(id);
      }
    }
    const maxX = nodes.length? Math.max(...nodes.map(n=>n.x+(n.w||46)+40)) : 200;
    const maxY = nodes.length? Math.max(...nodes.map(n=>n.y+(n.h||46)+50)) : 200;
    const w = Math.max(this.inner.parentElement.clientWidth, maxX);
    const h = Math.max(this.inner.parentElement.clientHeight, maxY);
    this.inner.style.width = w+'px'; this.inner.style.height = h+'px';
    this.svg.setAttribute('width', w); this.svg.setAttribute('height', h);
    this.svg.style.width = w+'px'; this.svg.style.height = h+'px';
    while(this.svg.children.length>1) this.svg.removeChild(this.svg.lastChild);
    (edges||[]).forEach(e=>{
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', e.x1); line.setAttribute('y1', e.y1);
      line.setAttribute('x2', e.x2); line.setAttribute('y2', e.y2);
      if(e.arrow) line.setAttribute('marker-end','url(#arrowhead)');
      if(e.cls) line.setAttribute('class', e.cls);
      this.svg.appendChild(line);
    });
  }
  flash(id, cls, ms){
    const rec = this.map.get(id); if(!rec) return;
    rec.el.classList.add(cls);
    if(ms) setTimeout(()=>{ if(rec.el.isConnected) rec.el.classList.remove(cls); }, ms);
  }
  setClass(id, cls){ const rec=this.map.get(id); if(rec){ rec.el.className='node '+cls; } }
  clear(){ this.map.forEach(r=>r.el.remove()); this.map.clear(); }
  center(id){
    const rec = this.map.get(id); if(!rec) return null;
    return {x: rec.el.offsetLeft + rec.el.offsetWidth/2, y: rec.el.offsetTop + rec.el.offsetHeight/2};
  }
}

/* ---------- tree layout helper (BST + Trie share this) ---------- */
function layoutTree(root, getChildren, spacingX, spacingY, marginX, marginY){
  let counter = 0;
  const pos = new Map();
  (function assign(node, depth){
    const kids = getChildren(node);
    if(kids.length===0){ pos.set(node, {slot: counter++, depth}); return; }
    kids.forEach(k=>assign(k, depth+1));
    const xs = kids.map(k=>pos.get(k).slot);
    pos.set(node, {slot: (Math.min(...xs)+Math.max(...xs))/2, depth});
  })(root, 0);
  const out = new Map();
  pos.forEach((v,k)=> out.set(k, {x: marginX + v.slot*spacingX, y: marginY + v.depth*spacingY}));
  return out;
}

let uidSeq = 1;
const nextUid = ()=> 'u'+(uidSeq++);

/* ================================================================
   PLAYGROUND SHELL
   ================================================================ */
function openPlayground(id){
  const myGen = ++GEN;
  const struct = STRUCTS.find(s=>s.id===id) || STRUCTS[0];
  document.querySelectorAll('.pg-tab').forEach(t=>{});
  const tabsEl = document.getElementById('pgTabs');
  tabsEl.innerHTML = STRUCTS.map(s=>`<a href="#/playground/${s.id}" class="pg-tab ${s.id===struct.id?'active':''}"><i class="fa-solid ${s.icon}"></i> ${s.name}</a>`).join('');

  const badges = sheetData[struct.id].map(r=>`<span class="cbadge">${r[0]} <b>${r[1]}</b></span>`).join('');

  document.getElementById('pgBody').innerHTML = `
    <div class="pg-head">
      <div><h2><i class="fa-solid ${struct.icon}"></i> ${struct.name}</h2><p>${struct.desc}</p></div>
      <div class="complexity-badges">${badges}</div>
    </div>
    <div class="pg-grid">
      <div class="panel">
        <div class="panel-title">Visualization</div>
        <div class="controls" id="ctrl"></div>
        <div class="stage"><div class="stage-inner" id="stageInner"><svg class="edge-svg" id="svg"></svg></div></div>
        <div class="panel-title" style="margin-top:16px;">Operation log</div>
        <div class="log-box" id="log"></div>
      </div>
      <div class="panel">
        <div class="tabbar" id="rtabs">
          <button data-t="code" class="active">Code</button>
          <button data-t="concepts">Concepts</button>
        </div>
        <div id="rpanel"></div>
      </div>
    </div>`;

  const ctrl = document.getElementById('ctrl');
  const stageInner = document.getElementById('stageInner');
  const svg = document.getElementById('svg');
  const logEl = document.getElementById('log');
  const rpanel = document.getElementById('rpanel');
  const rtabs = document.getElementById('rtabs');

  const stage = new Stage(stageInner, svg);
  const log = (msg)=>{
    const line = document.createElement('div');
    line.className='log-line'; line.textContent = msg;
    logEl.prepend(line);
    while(logEl.children.length>40) logEl.removeChild(logEl.lastChild);
  };
  const alive = ()=> myGen===GEN;

  const mod = MODULES[struct.id];
  ctrl.innerHTML = mod.controls;
  mod.init({stage, ctrl, log, alive, delay});

  let curLang = 'cpp';
  function renderCode(){
    const codeSrc = mod.code[curLang];
    rpanel.innerHTML = `
      <div class="tabbar" style="margin-bottom:10px;">
        <button data-l="cpp" class="${curLang==='cpp'?'active':''}">C++</button>
        <button data-l="python" class="${curLang==='python'?'active':''}">Python</button>
      </div>
      <pre class="code-block"><code>${highlight(codeSrc, curLang)}</code></pre>`;
    rpanel.querySelectorAll('[data-l]').forEach(b=>b.addEventListener('click', ()=>{ curLang=b.dataset.l; renderCode(); }));
  }
  function renderConcepts(){
    rpanel.innerHTML = `
      <table class="ctable"><thead><tr><th>Operation</th><th>Complexity</th></tr></thead>
      <tbody>${sheetData[struct.id].map(r=>`<tr><td class="op">${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}</tbody></table>
      <div class="concept-grid">${mod.concepts.map(c=>`<div class="concept-item"><h4>${c.h}</h4>${c.body}</div>`).join('')}</div>`;
  }
  rtabs.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
    rtabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if(b.dataset.t==='code') renderCode(); else renderConcepts();
  }));
  renderCode();
  mod.render();
}

/* ================================================================
   MODULE: STACK
   ================================================================ */
const StackModule = (()=>{
  let stage, log, alive;
  let arr = [];
  function positions(){
    const cx = 130;
    return arr.map((it,i)=>({ id:it.uid, label:String(it.val), x:cx, y: 270 - i*54, w:64, h:44, cls:'' , sub: i===arr.length-1?'TOP':''}));
  }
  function render(){ stage.sync(positions(), []); }
  return {
    controls: `
      <input type="text" id="valIn" placeholder="value" maxlength="6">
      <button class="op-btn" id="bPush">Push</button>
      <button class="op-btn pink" id="bPop">Pop</button>
      <button class="op-btn" id="bPeek">Peek</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; alive=ctx.alive; arr=[];
      ctx.ctrl.querySelector('#bPush').onclick = ()=>{
        const v = ctx.ctrl.querySelector('#valIn').value.trim() || String(Math.floor(Math.random()*90)+10);
        arr.push({uid: nextUid(), val: v});
        render(); log(`push(${v}) → top is now ${v}`);
        ctx.ctrl.querySelector('#valIn').value='';
      };
      ctx.ctrl.querySelector('#bPop').onclick = ()=>{
        if(!arr.length){ log('pop() → stack is empty'); return; }
        const it = arr.pop(); render(); log(`pop() → removed ${it.val}`);
      };
      ctx.ctrl.querySelector('#bPeek').onclick = ()=>{
        if(!arr.length){ log('peek() → stack is empty'); return; }
        const top = arr[arr.length-1];
        stage.flash(top.uid,'active',900); log(`peek() → ${top.val}`);
      };
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ arr=[]; render(); log('clear() → stack emptied'); };
    },
    render,
    code:{
cpp:`class Stack {
    vector<int> data;
public:
    void push(int v) { data.push_back(v); }
    void pop() {
        if (data.empty()) return; // underflow guard
        data.pop_back();
    }
    int peek() { return data.back(); }
    bool empty() { return data.empty(); }
};

// Usage
Stack s;
s.push(10);
s.push(20);
s.pop();          // removes 20
int top = s.peek();`,
python:`class Stack:
    def __init__(self):
        self.data = []

    def push(self, v):
        self.data.append(v)

    def pop(self):
        if not self.data:
            return None  # underflow guard
        return self.data.pop()

    def peek(self):
        return self.data[-1]

    def is_empty(self):
        return len(self.data) == 0

# Usage
s = Stack()
s.push(10)
s.push(20)
s.pop()      # removes 20
top = s.peek()`
    },
    concepts:[
      {h:'Core idea', body:'<p>LIFO — Last In, First Out. Only the top element is ever visible or reachable directly.</p>'},
      {h:'Where it\'s used', body:'<ul><li>Function call stack &amp; recursion</li><li>Undo/redo history</li><li>Expression evaluation, bracket matching</li><li>DFS traversal (explicit stack)</li></ul>'},
      {h:'Underflow / overflow', body:'<p>Popping an empty stack is <b>underflow</b>. A fixed-size array implementation can also <b>overflow</b> — always guard both ends.</p>'},
      {h:'Array vs linked list', body:'<p>Array-backed stacks are cache-friendly with O(1) amortised push. Linked-list stacks avoid resizing but cost extra pointer memory.</p>'},
    ]
  };
})();

/* ================================================================
   MODULE: QUEUE
   ================================================================ */
const QueueModule = (()=>{
  let stage, log;
  let arr = [];
  function positions(){
    return arr.map((it,i)=>{
      let sub = '';
      const isFront = i===0, isRear = i===arr.length-1;
      if(isFront && isRear) sub = 'FRONT/REAR';
      else if(isFront) sub = 'FRONT';
      else if(isRear) sub = 'REAR';
      return { id:it.uid, label:String(it.val), x: 24+i*72, y:130, w:56, h:44, sub };
    });
  }
  function render(){ stage.sync(positions(), []); }
  return {
    controls: `
      <input type="text" id="valIn" placeholder="value" maxlength="6">
      <button class="op-btn" id="bEnq">Enqueue</button>
      <button class="op-btn pink" id="bDeq">Dequeue</button>
      <button class="op-btn" id="bPeek">Peek</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; arr=[];
      ctx.ctrl.querySelector('#bEnq').onclick = ()=>{
        const v = ctx.ctrl.querySelector('#valIn').value.trim() || String(Math.floor(Math.random()*90)+10);
        arr.push({uid:nextUid(), val:v}); render(); log(`enqueue(${v}) → added to rear`);
        ctx.ctrl.querySelector('#valIn').value='';
      };
      ctx.ctrl.querySelector('#bDeq').onclick = ()=>{
        if(!arr.length){ log('dequeue() → queue is empty'); return; }
        const it = arr.shift(); render(); log(`dequeue() → removed ${it.val} from front`);
      };
      ctx.ctrl.querySelector('#bPeek').onclick = ()=>{
        if(!arr.length){ log('peek() → queue is empty'); return; }
        stage.flash(arr[0].uid,'active',900); log(`peek() → ${arr[0].val}`);
      };
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ arr=[]; render(); log('clear() → queue emptied'); };
    },
    render,
    code:{
cpp:`class Queue {
    deque<int> data;
public:
    void enqueue(int v) { data.push_back(v); }
    void dequeue() {
        if (data.empty()) return;
        data.pop_front();
    }
    int front() { return data.front(); }
    bool empty() { return data.empty(); }
};

// Usage
Queue q;
q.enqueue(1);
q.enqueue(2);
q.dequeue();       // removes 1
int f = q.front();`,
python:`from collections import deque

class Queue:
    def __init__(self):
        self.data = deque()

    def enqueue(self, v):
        self.data.append(v)

    def dequeue(self):
        if not self.data:
            return None
        return self.data.popleft()

    def front(self):
        return self.data[0]

# Usage
q = Queue()
q.enqueue(1)
q.enqueue(2)
q.dequeue()   # removes 1
f = q.front()`
    },
    concepts:[
      {h:'Core idea', body:'<p>FIFO — First In, First Out. Insert at the rear, remove from the front.</p>'},
      {h:'Where it\'s used', body:'<ul><li>Task &amp; process scheduling</li><li>BFS traversal</li><li>Print/print-job queues, buffering</li><li>Message queues between services</li></ul>'},
      {h:'Circular queue', body:'<p>Array-backed queues waste space unless implemented as a <b>circular buffer</b>, wrapping the rear index with modulo arithmetic.</p>'},
      {h:'Variants', body:'<ul><li>Deque — insert/remove both ends</li><li>Priority queue — served by priority, not order (see Heap)</li></ul>'},
    ]
  };
})();

/* ================================================================
   MODULE: LINKED LIST
   ================================================================ */
const ListModule = (()=>{
  let stage, log;
  let arr = [];
  function positions(){
    const nodes = arr.map((it,i)=>({ id:it.uid, label:String(it.val), x:24+i*108, y:130, w:56, h:44 }));
    nodes.push({id:'__null', label:'NULL', x:24+arr.length*108, y:130, w:56, h:44, cls:'done'});
    const edges = [];
    for(let i=0;i<nodes.length-1;i++){
      const a=nodes[i], b=nodes[i+1];
      edges.push({x1:a.x+a.w, y1:a.y+a.h/2, x2:b.x, y2:b.y+b.h/2, arrow:true});
    }
    return {nodes, edges};
  }
  function render(){ const {nodes,edges}=positions(); stage.sync(nodes, edges); }
  return {
    controls: `
      <input type="text" id="valIn" placeholder="value" maxlength="6">
      <button class="op-btn" id="bHead">Insert Head</button>
      <button class="op-btn" id="bTail">Insert Tail</button>
      <button class="op-btn pink" id="bDel">Delete Value</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; arr=[];
      const val = ()=> ctx.ctrl.querySelector('#valIn').value.trim() || String(Math.floor(Math.random()*90)+10);
      ctx.ctrl.querySelector('#bHead').onclick = ()=>{
        const v = val(); arr.unshift({uid:nextUid(), val:v}); render(); log(`insertHead(${v})`);
        ctx.ctrl.querySelector('#valIn').value='';
      };
      ctx.ctrl.querySelector('#bTail').onclick = ()=>{
        const v = val(); arr.push({uid:nextUid(), val:v}); render(); log(`insertTail(${v})`);
        ctx.ctrl.querySelector('#valIn').value='';
      };
      ctx.ctrl.querySelector('#bDel').onclick = ()=>{
        const v = ctx.ctrl.querySelector('#valIn').value.trim();
        const idx = arr.findIndex(it=>it.val===v);
        if(idx===-1){ log(`delete(${v||'?'}) → not found`); return; }
        arr.splice(idx,1); render(); log(`delete(${v}) → removed`);
      };
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ arr=[]; render(); log('clear() → list emptied'); };
    },
    render,
    code:{
cpp:`struct Node {
    int val;
    Node* next;
    Node(int v) : val(v), next(nullptr) {}
};

class LinkedList {
    Node* head = nullptr;
public:
    void insertHead(int v) {
        Node* n = new Node(v);
        n->next = head;
        head = n;
    }
    void insertTail(int v) {
        Node* n = new Node(v);
        if (!head) { head = n; return; }
        Node* cur = head;
        while (cur->next) cur = cur->next;
        cur->next = n;
    }
    void remove(int v) {
        if (!head) return;
        if (head->val == v) { head = head->next; return; }
        Node* cur = head;
        while (cur->next && cur->next->val != v) cur = cur->next;
        if (cur->next) cur->next = cur->next->next;
    }
};`,
python:`class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def insert_head(self, v):
        n = Node(v)
        n.next = self.head
        self.head = n

    def insert_tail(self, v):
        n = Node(v)
        if not self.head:
            self.head = n
            return
        cur = self.head
        while cur.next:
            cur = cur.next
        cur.next = n

    def remove(self, v):
        if not self.head:
            return
        if self.head.val == v:
            self.head = self.head.next
            return
        cur = self.head
        while cur.next and cur.next.val != v:
            cur = cur.next
        if cur.next:
            cur.next = cur.next.next`
    },
    concepts:[
      {h:'Core idea', body:'<p>A chain of nodes, each holding a value and a pointer to the next. No contiguous memory required.</p>'},
      {h:'vs. array', body:'<ul><li>O(1) insert at head (array: O(n) shift)</li><li>No random access — O(n) to reach index i</li><li>Extra pointer memory per node</li></ul>'},
      {h:'Variants', body:'<ul><li>Doubly linked — prev + next pointers</li><li>Circular — tail points back to head</li></ul>'},
      {h:'Where it\'s used', body:'<p>LRU caches, adjacency lists for graphs, implementing stacks/queues without resizing.</p>'},
    ]
  };
})();

/* ================================================================
   MODULE: TREE (BST)
   ================================================================ */
const TreeModule = (()=>{
  let stage, log, alive;
  let root = null;

  function children(n){ const c=[]; if(n.left) c.push(n.left); if(n.right) c.push(n.right); return c; }
  function allNodes(n, out=[]){ if(!n) return out; allNodes(n.left,out); out.push(n); allNodes(n.right,out); return out; }

  function render(){
    if(!root){ stage.sync([], []); return; }
    const pos = layoutTree(root, children, 62, 68, 40, 24);
    const nodes = allNodes(root).map(n=>({id:n.uid, label:String(n.val), x:pos.get(n).x, y:pos.get(n).y, w:44, h:44, cls:'circle'}));
    const edges = [];
    allNodes(root).forEach(n=>{
      [n.left,n.right].forEach(c=>{
        if(c) edges.push({x1:pos.get(n).x+22, y1:pos.get(n).y+22, x2:pos.get(c).x+22, y2:pos.get(c).y+22});
      });
    });
    stage.sync(nodes, edges);
  }

  async function insert(v){
    const newNode = {uid:nextUid(), val:v, left:null, right:null};
    if(!root){ root=newNode; render(); log(`insert(${v}) → set as root`); return; }
    let cur = root;
    while(true){
      render();
      stage.flash(cur.uid,'active',700);
      await delay(480);
      if(!alive()) return;
      if(v===cur.val){ log(`insert(${v}) → value already exists`); return; }
      if(v<cur.val){
        if(!cur.left){ cur.left=newNode; break; }
        cur = cur.left;
      } else {
        if(!cur.right){ cur.right=newNode; break; }
        cur = cur.right;
      }
    }
    render(); log(`insert(${v}) → placed in tree`);
  }
  async function search(v){
    let cur = root;
    if(!cur){ log(`search(${v}) → tree is empty`); return; }
    while(cur){
      stage.flash(cur.uid,'active',650);
      await delay(500);
      if(!alive()) return;
      if(cur.val===v){ stage.flash(cur.uid,'target',1000); log(`search(${v}) → found`); return; }
      cur = v<cur.val ? cur.left : cur.right;
    }
    log(`search(${v}) → not found`);
  }
  async function traverse(kind){
    if(!root){ log(`${kind} → tree is empty`); return; }
    const order = [];
    (function walk(n){
      if(!n) return;
      if(kind==='preorder') order.push(n);
      walk(n.left);
      if(kind==='inorder') order.push(n);
      walk(n.right);
      if(kind==='postorder') order.push(n);
    })(root);
    let bfsOrder = [];
    if(kind==='levelorder'){
      const q=[root];
      while(q.length){ const n=q.shift(); bfsOrder.push(n); if(n.left) q.push(n.left); if(n.right) q.push(n.right); }
    }
    const seq = kind==='levelorder' ? bfsOrder : order;
    for(const n of seq){
      if(!alive()) return;
      stage.flash(n.uid,'active',600);
      await delay(430);
    }
    log(`${kind} → ${seq.map(n=>n.val).join(', ')}`);
  }

  return {
    controls: `
      <input type="number" id="valIn" placeholder="value">
      <button class="op-btn" id="bIns">Insert</button>
      <button class="op-btn" id="bSearch">Search</button>
      <button class="op-btn" id="bIn">Inorder</button>
      <button class="op-btn" id="bPre">Preorder</button>
      <button class="op-btn" id="bPost">Postorder</button>
      <button class="op-btn" id="bLevel">Level-order</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; alive=ctx.alive; root=null;
      const val = ()=> parseInt(ctx.ctrl.querySelector('#valIn').value) || Math.floor(Math.random()*90)+10;
      ctx.ctrl.querySelector('#bIns').onclick = ()=>{ insert(val()); ctx.ctrl.querySelector('#valIn').value=''; };
      ctx.ctrl.querySelector('#bSearch').onclick = ()=> search(val());
      ctx.ctrl.querySelector('#bIn').onclick = ()=> traverse('inorder');
      ctx.ctrl.querySelector('#bPre').onclick = ()=> traverse('preorder');
      ctx.ctrl.querySelector('#bPost').onclick = ()=> traverse('postorder');
      ctx.ctrl.querySelector('#bLevel').onclick = ()=> traverse('levelorder');
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ root=null; render(); log('clear() → tree emptied'); };
    },
    render,
    code:{
cpp:`struct Node {
    int val; Node *left, *right;
    Node(int v): val(v), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int v) {
    if (!root) return new Node(v);
    if (v < root->val) root->left  = insert(root->left, v);
    else if (v > root->val) root->right = insert(root->right, v);
    return root;
}

bool search(Node* root, int v) {
    if (!root) return false;
    if (root->val == v) return true;
    return v < root->val ? search(root->left, v) : search(root->right, v);
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->val << " ";
    inorder(root->right);
}`,
python:`class Node:
    def __init__(self, val):
        self.val = val
        self.left = self.right = None

def insert(root, v):
    if root is None:
        return Node(v)
    if v < root.val:
        root.left = insert(root.left, v)
    elif v > root.val:
        root.right = insert(root.right, v)
    return root

def search(root, v):
    if root is None:
        return False
    if root.val == v:
        return True
    return search(root.left, v) if v < root.val else search(root.right, v)

def inorder(root, out):
    if root is None:
        return
    inorder(root.left, out)
    out.append(root.val)
    inorder(root.right, out)`
    },
    concepts:[
      {h:'BST invariant', body:'<p>For every node: everything in the left subtree is smaller, everything in the right subtree is larger.</p>'},
      {h:'Traversals', body:'<ul><li><b>Inorder</b> — left, node, right → sorted order</li><li><b>Preorder</b> — node, left, right → copy the tree</li><li><b>Postorder</b> — left, right, node → delete safely</li><li><b>Level-order</b> — BFS by depth</li></ul>'},
      {h:'Balance matters', body:'<p>A skewed BST (sorted insertions) degrades to O(n), like a linked list. Self-balancing variants (AVL, Red-Black) guarantee O(log n).</p>'},
      {h:'Height formula', body:'<p>Best case height = ⌊log₂ n⌋. Worst case height = n − 1.</p>'},
    ]
  };
})();

/* ================================================================
   MODULE: GRAPH
   ================================================================ */
const GraphModule = (()=>{
  let stage, log, alive;
  let nodes = []; // {uid, label, x, y}
  let adj = new Map(); // uid -> Set(uid)

  function relayout(){
    const cx=280, cy=150, r=Math.min(120, 40+nodes.length*8);
    nodes.forEach((n,i)=>{
      const a = (2*Math.PI*i)/Math.max(nodes.length,1) - Math.PI/2;
      n.x = cx + r*Math.cos(a) - 22;
      n.y = cy + r*Math.sin(a) - 22;
    });
  }
  function render(){
    relayout();
    const nList = nodes.map(n=>({id:n.uid, label:n.label, x:n.x, y:n.y, w:44, h:44, cls:'circle'}));
    const edges = [];
    adj.forEach((set,a)=>{
      set.forEach(b=>{
        if(a<b){
          const na=nodes.find(n=>n.uid===a), nb=nodes.find(n=>n.uid===b);
          if(na&&nb) edges.push({x1:na.x+22,y1:na.y+22,x2:nb.x+22,y2:nb.y+22});
        }
      });
    });
    stage.sync(nList, edges);
  }
  function findByLabel(l){ return nodes.find(n=>n.label===l); }

  async function bfs(startLabel){
    const s = findByLabel(startLabel);
    if(!s){ log(`bfs(${startLabel}) → node not found`); return; }
    const visited = new Set([s.uid]);
    const q=[s.uid]; const order=[startLabel];
    while(q.length){
      const cur = q.shift();
      stage.flash(cur,'active',650); await delay(480);
      if(!alive()) return;
      stage.flash(cur,'done',5000);
      const set = adj.get(cur) || new Set();
      [...set].forEach(nb=>{
        if(!visited.has(nb)){ visited.add(nb); q.push(nb); order.push(nodes.find(n=>n.uid===nb).label); }
      });
    }
    log(`bfs(${startLabel}) → ${order.join(', ')}`);
  }
  async function dfs(startLabel){
    const s = findByLabel(startLabel);
    if(!s){ log(`dfs(${startLabel}) → node not found`); return; }
    const visited = new Set(); const order=[];
    async function walk(u){
      if(visited.has(u) || !alive()) return;
      visited.add(u);
      stage.flash(u,'active',650); await delay(480);
      if(!alive()) return;
      stage.flash(u,'done',5000);
      order.push(nodes.find(n=>n.uid===u).label);
      const set = [...(adj.get(u)||new Set())];
      for(const nb of set){ await walk(nb); }
    }
    await walk(s.uid);
    log(`dfs(${startLabel}) → ${order.join(', ')}`);
  }

  return {
    controls: `
      <input type="text" id="nodeIn" placeholder="node label" maxlength="4" style="width:90px;">
      <button class="op-btn" id="bAddNode">Add Node</button>
      <input type="text" id="edgeA" placeholder="A" maxlength="4" style="width:56px;">
      <input type="text" id="edgeB" placeholder="B" maxlength="4" style="width:56px;">
      <button class="op-btn" id="bAddEdge">Add Edge</button>
      <input type="text" id="startIn" placeholder="start" maxlength="4" style="width:66px;">
      <button class="op-btn" id="bBFS">BFS</button>
      <button class="op-btn" id="bDFS">DFS</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; alive=ctx.alive; nodes=[]; adj=new Map();
      ctx.ctrl.querySelector('#bAddNode').onclick = ()=>{
        const inp = ctx.ctrl.querySelector('#nodeIn');
        const l = inp.value.trim() || String.fromCharCode(65+nodes.length%26);
        if(findByLabel(l)){ log(`addNode(${l}) → already exists`); return; }
        nodes.push({uid:nextUid(), label:l, x:0, y:0}); adj.set(nodes[nodes.length-1].uid, new Set());
        render(); log(`addNode(${l})`); inp.value='';
      };
      ctx.ctrl.querySelector('#bAddEdge').onclick = ()=>{
        const a = findByLabel(ctx.ctrl.querySelector('#edgeA').value.trim());
        const b = findByLabel(ctx.ctrl.querySelector('#edgeB').value.trim());
        if(!a||!b){ log('addEdge() → both nodes must exist'); return; }
        adj.get(a.uid).add(b.uid); adj.get(b.uid).add(a.uid);
        render(); log(`addEdge(${a.label}, ${b.label})`);
      };
      ctx.ctrl.querySelector('#bBFS').onclick = ()=> bfs(ctx.ctrl.querySelector('#startIn').value.trim() || (nodes[0]&&nodes[0].label));
      ctx.ctrl.querySelector('#bDFS').onclick = ()=> dfs(ctx.ctrl.querySelector('#startIn').value.trim() || (nodes[0]&&nodes[0].label));
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ nodes=[]; adj=new Map(); render(); log('clear() → graph emptied'); };
    },
    render,
    code:{
cpp:`unordered_map<int, vector<int>> adj;

void addEdge(int a, int b) {
    adj[a].push_back(b);
    adj[b].push_back(a); // undirected
}

void bfs(int start) {
    queue<int> q;
    set<int> visited;
    q.push(start); visited.insert(start);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        cout << u << " ";
        for (int v : adj[u])
            if (!visited.count(v)) { visited.insert(v); q.push(v); }
    }
}

void dfs(int u, set<int>& visited) {
    visited.insert(u);
    cout << u << " ";
    for (int v : adj[u])
        if (!visited.count(v)) dfs(v, visited);
}`,
python:`from collections import defaultdict, deque

adj = defaultdict(list)

def add_edge(a, b):
    adj[a].append(b)
    adj[b].append(a)  # undirected

def bfs(start):
    visited = {start}
    q = deque([start])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            if v not in visited:
                visited.add(v)
                q.append(v)
    return order

def dfs(u, visited=None, order=None):
    if visited is None: visited, order = set(), []
    visited.add(u)
    order.append(u)
    for v in adj[u]:
        if v not in visited:
            dfs(v, visited, order)
    return order`
    },
    concepts:[
      {h:'Representations', body:'<ul><li>Adjacency list — O(V+E) space, fast to iterate neighbours</li><li>Adjacency matrix — O(V²) space, O(1) edge lookup</li></ul>'},
      {h:'BFS vs DFS', body:'<p><b>BFS</b> explores level by level (queue) — shortest path in unweighted graphs. <b>DFS</b> goes as deep as possible first (stack/recursion) — cycle detection, topological sort.</p>'},
      {h:'Directed vs undirected', body:'<p>This playground builds undirected graphs. Directed graphs store edges one-way and power dependency graphs, web links, and DAGs.</p>'},
      {h:'Weighted graphs', body:'<p>Attach a cost to each edge to unlock Dijkstra, Bellman-Ford and MST algorithms (Prim/Kruskal).</p>'},
    ]
  };
})();

/* ================================================================
   MODULE: HEAP (min-heap)
   ================================================================ */
const HeapModule = (()=>{
  let stage, log, alive;
  let arr = []; // [{uid,val}]

  function render(){
    const arrNodes = arr.map((it,i)=>({id:'a-'+it.uid, label:String(it.val), x:24+i*54, y:20, w:44, h:40, sub:String(i)}));
    const treeNodes = [];
    const edges = [];
    arr.forEach((it,i)=>{
      const level = Math.floor(Math.log2(i+1));
      const posInLevel = i - (2**level - 1);
      const levelWidth = 2**level;
      const totalWidth = 480;
      const x = (posInLevel + 0.5) / levelWidth * totalWidth - 22 + 20;
      const y = 100 + level*66;
      treeNodes.push({id:'t-'+it.uid, label:String(it.val), x, y, w:44, h:44, cls:'circle'});
      const parent = Math.floor((i-1)/2);
      if(i>0){
        const p = arr[parent];
        const pl = Math.floor(Math.log2(parent+1));
        const pPos = parent - (2**pl - 1);
        const pW = 2**pl;
        const px = (pPos+0.5)/pW*480 - 22 + 20;
        const py = 100 + pl*66;
        edges.push({x1:px+22, y1:py+22, x2:x+22, y2:y+22});
      }
    });
    stage.sync([...arrNodes, ...treeNodes], edges);
  }

  async function swap(i,j){
    [arr[i], arr[j]] = [arr[j], arr[i]];
    render();
    await delay(480);
  }
  async function bubbleUp(i){
    while(i>0){
      const p = Math.floor((i-1)/2);
      stage.flash('a-'+arr[i].uid,'active',450); stage.flash('t-'+arr[i].uid,'active',450);
      stage.flash('a-'+arr[p].uid,'active',450); stage.flash('t-'+arr[p].uid,'active',450);
      await delay(420);
      if(!alive()) return;
      if(arr[p].val <= arr[i].val) break;
      await swap(i,p);
      i = p;
    }
  }
  async function bubbleDown(i){
    const n = arr.length;
    while(true){
      let smallest = i, l=2*i+1, r=2*i+2;
      if(l<n && arr[l].val < arr[smallest].val) smallest=l;
      if(r<n && arr[r].val < arr[smallest].val) smallest=r;
      if(smallest===i) break;
      await swap(i, smallest);
      i = smallest;
    }
  }

  async function insert(v){
    arr.push({uid:nextUid(), val:v});
    render(); await delay(300);
    log(`insert(${v}) → added at end, bubbling up`);
    await bubbleUp(arr.length-1);
    render(); log(`insert(${v}) → heap restored`);
  }
  async function extractMin(){
    if(!arr.length){ log('extractMin() → heap is empty'); return; }
    const min = arr[0];
    const last = arr.pop();
    if(arr.length){ arr[0]=last; }
    render(); await delay(300);
    log(`extractMin() → removed ${min.val}`);
    await bubbleDown(0);
    render();
  }

  return {
    controls: `
      <input type="number" id="valIn" placeholder="value">
      <button class="op-btn" id="bIns">Insert</button>
      <button class="op-btn pink" id="bExt">Extract Min</button>
      <button class="op-btn" id="bPeek">Peek</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; alive=ctx.alive; arr=[];
      const val = ()=> parseInt(ctx.ctrl.querySelector('#valIn').value) || Math.floor(Math.random()*90)+10;
      ctx.ctrl.querySelector('#bIns').onclick = ()=>{ insert(val()); ctx.ctrl.querySelector('#valIn').value=''; };
      ctx.ctrl.querySelector('#bExt').onclick = ()=> extractMin();
      ctx.ctrl.querySelector('#bPeek').onclick = ()=>{
        if(!arr.length){ log('peek() → heap is empty'); return; }
        stage.flash('a-'+arr[0].uid,'active',900); stage.flash('t-'+arr[0].uid,'active',900);
        log(`peek() → ${arr[0].val}`);
      };
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ arr=[]; render(); log('clear() → heap emptied'); };
    },
    render,
    code:{
cpp:`class MinHeap {
    vector<int> h;
    void bubbleUp(int i) {
        while (i > 0) {
            int p = (i-1)/2;
            if (h[p] <= h[i]) break;
            swap(h[p], h[i]); i = p;
        }
    }
    void bubbleDown(int i) {
        int n = h.size();
        while (true) {
            int s=i, l=2*i+1, r=2*i+2;
            if (l<n && h[l]<h[s]) s=l;
            if (r<n && h[r]<h[s]) s=r;
            if (s==i) break;
            swap(h[i], h[s]); i=s;
        }
    }
public:
    void insert(int v) { h.push_back(v); bubbleUp(h.size()-1); }
    int extractMin() {
        int m = h[0];
        h[0] = h.back(); h.pop_back();
        bubbleDown(0);
        return m;
    }
};`,
python:`import heapq

class MinHeap:
    def __init__(self):
        self.h = []

    def insert(self, v):
        heapq.heappush(self.h, v)

    def extract_min(self):
        return heapq.heappop(self.h)

    def peek(self):
        return self.h[0]

# Manual bubble-up/down version:
def bubble_up(h, i):
    while i > 0:
        p = (i - 1) // 2
        if h[p] <= h[i]:
            break
        h[p], h[i] = h[i], h[p]
        i = p`
    },
    concepts:[
      {h:'Heap order', body:'<p>Min-heap: every parent ≤ its children. The minimum is always at the root — O(1) to read.</p>'},
      {h:'Index formulas', body:'<p>For node at index i: parent = (i−1)/2, left child = 2i+1, right child = 2i+2.</p>'},
      {h:'Why array, not pointers', body:'<p>A heap is a <b>complete</b> binary tree, so it packs perfectly into an array with no gaps — no pointer overhead needed.</p>'},
      {h:'Where it\'s used', body:'<ul><li>Priority queues</li><li>Heapsort — O(n log n)</li><li>Dijkstra\'s &amp; Prim\'s algorithms</li><li>Median maintenance (two heaps)</li></ul>'},
    ]
  };
})();

/* ================================================================
   MODULE: TRIE
   ================================================================ */
const TrieModule = (()=>{
  let stage, log, alive;
  let root;
  function fresh(){ return {uid:nextUid(), ch:'•', isEnd:false, children:new Map()}; }

  function orderedChildren(n){ return [...n.children.values()].sort((a,b)=>a.ch.localeCompare(b.ch)); }
  function allNodes(n, out=[]){ out.push(n); orderedChildren(n).forEach(c=>allNodes(c,out)); return out; }

  function render(){
    const pos = layoutTree(root, orderedChildren, 52, 66, 30, 24);
    const nodes = allNodes(root).map(n=>({id:n.uid, label:n.ch, x:pos.get(n).x, y:pos.get(n).y, w:40, h:40, cls: 'circle'+(n.isEnd?' done':'')}));
    const edges = [];
    allNodes(root).forEach(n=> orderedChildren(n).forEach(c=>{
      edges.push({x1:pos.get(n).x+20, y1:pos.get(n).y+20, x2:pos.get(c).x+20, y2:pos.get(c).y+20});
    }));
    stage.sync(nodes, edges);
  }

  async function insertWord(word){
    let cur = root;
    for(const ch of word.toLowerCase()){
      if(!cur.children.has(ch)){
        const n = fresh(); n.ch = ch; cur.children.set(ch, n);
      }
      render(); await delay(60);
      cur = cur.children.get(ch);
      stage.flash(cur.uid,'active',500);
      await delay(380);
      if(!alive()) return;
    }
    cur.isEnd = true;
    render(); log(`insert("${word}") → word added`);
  }
  async function searchWord(word, prefixOnly){
    let cur = root;
    for(const ch of word.toLowerCase()){
      if(!cur.children.has(ch)){ log(`${prefixOnly?'startsWith':'search'}("${word}") → not found`); return; }
      cur = cur.children.get(ch);
      stage.flash(cur.uid,'active',480); await delay(400);
      if(!alive()) return;
    }
    if(prefixOnly){ stage.flash(cur.uid,'target',1000); log(`startsWith("${word}") → prefix exists`); return; }
    if(cur.isEnd){ stage.flash(cur.uid,'target',1000); log(`search("${word}") → found`); }
    else log(`search("${word}") → prefix exists, but not a full word`);
  }

  return {
    controls: `
      <input type="text" id="wordIn" placeholder="word" maxlength="10">
      <button class="op-btn" id="bIns">Insert</button>
      <button class="op-btn" id="bSearch">Search</button>
      <button class="op-btn" id="bPrefix">Starts With</button>
      <button class="op-btn pink" id="bClear">Clear</button>`,
    init(ctx){
      stage=ctx.stage; log=ctx.log; alive=ctx.alive; root = fresh();
      const val = ()=> ctx.ctrl.querySelector('#wordIn').value.trim() || 'cat';
      ctx.ctrl.querySelector('#bIns').onclick = ()=>{ insertWord(val()); };
      ctx.ctrl.querySelector('#bSearch').onclick = ()=> searchWord(val(), false);
      ctx.ctrl.querySelector('#bPrefix').onclick = ()=> searchWord(val(), true);
      ctx.ctrl.querySelector('#bClear').onclick = ()=>{ root = fresh(); render(); log('clear() → trie emptied'); };
    },
    render,
    code:{
cpp:`struct TrieNode {
    bool isEnd = false;
    unordered_map<char, TrieNode*> children;
};

class Trie {
    TrieNode* root = new TrieNode();
public:
    void insert(string word) {
        TrieNode* cur = root;
        for (char c : word) {
            if (!cur->children.count(c)) cur->children[c] = new TrieNode();
            cur = cur->children[c];
        }
        cur->isEnd = true;
    }
    bool search(string word) {
        TrieNode* cur = root;
        for (char c : word) {
            if (!cur->children.count(c)) return false;
            cur = cur->children[c];
        }
        return cur->isEnd;
    }
    bool startsWith(string prefix) {
        TrieNode* cur = root;
        for (char c : prefix) {
            if (!cur->children.count(c)) return false;
            cur = cur->children[c];
        }
        return true;
    }
};`,
python:`class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        cur = self.root
        for ch in word:
            cur = cur.children.setdefault(ch, TrieNode())
        cur.is_end = True

    def search(self, word):
        cur = self.root
        for ch in word:
            if ch not in cur.children:
                return False
            cur = cur.children[ch]
        return cur.is_end

    def starts_with(self, prefix):
        cur = self.root
        for ch in prefix:
            if ch not in cur.children:
                return False
            cur = cur.children[ch]
        return True`
    },
    concepts:[
      {h:'Core idea', body:'<p>A tree where each edge is a character. Words that share a prefix share the same path from the root.</p>'},
      {h:'Where it\'s used', body:'<ul><li>Autocomplete &amp; typeahead search</li><li>Spell checking</li><li>IP routing (longest prefix match)</li><li>T9 predictive text</li></ul>'},
      {h:'Complexity', body:'<p>Insert/search cost O(L) where L is the word length — independent of how many words are stored.</p>'},
      {h:'Trade-off', body:'<p>Fast lookups, but can use more memory than a hash set since every distinct prefix gets its own node.</p>'},
    ]
  };
})();

const MODULES = {
  stack: StackModule, queue: QueueModule, linkedlist: ListModule,
  tree: TreeModule, graph: GraphModule, heap: HeapModule, trie: TrieModule,
};

/* ================================================================
   BASICS PAGE — Big-O charts + vector resizer
   ================================================================ */
let tChart=null, pChart=null, basicsInited=false, vecCap=4, vecSize=0;

function themeColors(){
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  return { grid: dark?'#334155':'#e2e8f0', text: dark?'#94a3b8':'#475569', card: dark?'#1e293b':'#ffffff' };
}
function buildBasicsCharts(){
  if(!document.getElementById('timeComplexityChart')) return;
  const {grid,text,card} = themeColors();
  const labels=[10,20,30,40,50,60,70];
  const O1 = labels.map(()=>5);
  const OlogN = labels.map(n=>5*Math.log2(n));
  const ON = labels.map(n=>n);
  const ON2 = labels.map(n=>(n*n)*0.05);
  const ctx1 = document.getElementById('timeComplexityChart').getContext('2d');
  if(tChart) tChart.destroy();
  tChart = new Chart(ctx1, {type:'line', data:{labels, datasets:[
    {label:'O(1)', data:O1, borderColor:'#10b981', tension:.4, pointRadius:0, borderWidth:2},
    {label:'O(log n)', data:OlogN, borderColor:'#3b82f6', tension:.4, pointRadius:0, borderWidth:2},
    {label:'O(n)', data:ON, borderColor:'#eab308', tension:.4, pointRadius:0, borderWidth:2},
    {label:'O(n²)', data:ON2, borderColor:'#ef4444', tension:.4, pointRadius:0, borderWidth:2},
  ]}, options:{responsive:true, maintainAspectRatio:false,
    scales:{x:{grid:{color:grid}, ticks:{color:text}, title:{display:true, text:'input size (n)', color:text}},
            y:{grid:{color:grid}, ticks:{color:text}, title:{display:true, text:'operations', color:text}}},
    plugins:{legend:{labels:{color:text}}}, interaction:{mode:'index', intersect:false}
  }});
  const ctx2 = document.getElementById('memoryPieChart').getContext('2d');
  if(pChart) pChart.destroy();
  pChart = new Chart(ctx2, {type:'pie', data:{labels:['Actual data','Pointer overhead','Padding / metadata'],
    datasets:[{data:[40,45,15], backgroundColor:['#3b82f6','#8b5cf6','#64748b'], borderWidth:2, borderColor:card}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{color:text}}}}});
}
window.refreshBasicsCharts = ()=>{ if(basicsInited) buildBasicsCharts(); };

function fillNextVectorSlot(gridEl, sizeEl){
  const slot = gridEl.children[vecSize];
  if(!slot) return;
  slot.textContent = Math.floor(Math.random()*90)+10;
  slot.classList.add('filled');
  vecSize++; sizeEl.textContent = vecSize;
}
function initVectorResizer(){
  vecCap=4; vecSize=0;
  const gridEl = document.getElementById('vecGrid');
  const sizeEl = document.getElementById('vecSize');
  const capEl = document.getElementById('vecCap');
  const msgEl = document.getElementById('vecMsg');
  gridEl.style.gridTemplateColumns = 'repeat(4,1fr)';
  gridEl.innerHTML='';
  for(let i=0;i<vecCap;i++){ const d=document.createElement('div'); d.className='vec-slot'; gridEl.appendChild(d); }
  sizeEl.textContent=vecSize; capEl.textContent=vecCap;
  document.getElementById('bVecAdd').onclick = ()=>{
    if(vecSize>=vecCap){
      msgEl.classList.add('show'); gridEl.classList.add('alert');
      setTimeout(()=>{
        vecCap*=2;
        gridEl.style.gridTemplateColumns = `repeat(${Math.min(vecCap,8)},1fr)`;
        for(let i=0;i<vecCap/2;i++){ const d=document.createElement('div'); d.className='vec-slot'; gridEl.appendChild(d); }
        capEl.textContent=vecCap;
        gridEl.classList.remove('alert'); msgEl.classList.remove('show');
        fillNextVectorSlot(gridEl, sizeEl);
      }, 900);
    } else {
      fillNextVectorSlot(gridEl, sizeEl);
    }
  };
}
window.initBasics = function(){
  if(basicsInited) return;
  buildBasicsCharts();
  initVectorResizer();
  basicsInited = true;
};

/* ================================================================
   HERO MORPH ANIMATION
   ================================================================ */
(function morph(){
  const stage = document.getElementById('morphStage');
  const labelEl = document.getElementById('morphLabel');
  if(!stage) return;
  const N = 8;
  const nodes = [];
  for(let i=0;i<N;i++){
    const d = document.createElement('div');
    d.className='morph-node';
    d.textContent = i;
    stage.appendChild(d);
    nodes.push(d);
  }
  const svgNS='http://www.w3.org/2000/svg';
  const edgeLayer = document.createElementNS(svgNS,'svg');
  edgeLayer.setAttribute('style','position:absolute; inset:0; width:100%; height:100%; pointer-events:none;');
  stage.insertBefore(edgeLayer, stage.firstChild.nextSibling);

  function layouts(w,h){
    const arr=[], stack=[], queue=[], tree=[], graph=[], heap=[], trie=[];
    for(let i=0;i<N;i++){
      arr.push({x: 40+i*((w-80)/(N-1)), y:h/2-23});
      stack.push({x: w/2-23, y: h-70-i*40});
      queue.push({x: 30+i*((w-60)/(N-1)), y:h/2-23});
    }
    // simple binary tree layout for 8 nodes (indices as complete tree)
    for(let i=0;i<N;i++){
      const level = Math.floor(Math.log2(i+1));
      const posInLevel = i-(2**level-1);
      const lw = 2**level;
      tree.push({x: (posInLevel+0.5)/lw*w-23, y: 30+level*70});
      heap.push({x: (posInLevel+0.5)/lw*w-23, y: 30+level*70});
    }
    for(let i=0;i<N;i++){
      const a = (2*Math.PI*i)/N - Math.PI/2;
      const r = Math.min(w,h)/2 - 50;
      graph.push({x: w/2 + r*Math.cos(a)-23, y: h/2 + r*Math.sin(a)-23});
    }
    for(let i=0;i<N;i++){
      const depth = i%4;
      trie.push({x: 40+depth*100, y: 30+((i*57)%230)});
    }
    return {array:arr, stack, queue, tree, graph, heap, trie};
  }

  const edgesFor = {
    tree: [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7]],
    heap: [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7]],
    graph:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,4],[2,6]],
    queue:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]],
    trie:[[0,1],[0,2],[1,3],[2,4],[0,5],[5,6],[6,7]],
  };

  const order = ['array','stack','queue','linked list','tree','graph','heap','trie'];
  const keyFor = {array:'array', stack:'stack', queue:'queue', 'linked list':'queue', tree:'tree', graph:'graph', heap:'heap', trie:'trie'};
  let idx = 0;

  function apply(name){
    const w = stage.clientWidth, h = stage.clientHeight;
    const L = layouts(w,h);
    const key = keyFor[name];
    const pts = L[key];
    nodes.forEach((n,i)=>{
      n.style.transform = `translate(${pts[i].x}px, ${pts[i].y}px)`;
      n.classList.toggle('on', name==='linked list' ? i%2===0 : (key==='graph'||key==='trie') && i%3===0);
      n.style.borderRadius = (key==='graph'||key==='tree'||key==='heap'||key==='trie') ? '50%' : '10px';
    });
    edgeLayer.innerHTML='';
    const eKey = name==='linked list' ? 'queue' : key;
    const e = edgesFor[eKey];
    if(e){
      e.forEach(([a,b])=>{
        const line = document.createElementNS(svgNS,'line');
        line.setAttribute('x1', pts[a].x+23); line.setAttribute('y1', pts[a].y+23);
        line.setAttribute('x2', pts[b].x+23); line.setAttribute('y2', pts[b].y+23);
        line.setAttribute('stroke','currentColor');
        line.setAttribute('style','color:var(--border); stroke-width:2;');
        edgeLayer.appendChild(line);
      });
    }
    labelEl.textContent = name;
  }

  apply(order[0]);
  setInterval(()=>{
    idx = (idx+1) % order.length;
    apply(order[idx]);
  }, 2600);
  window.addEventListener('resize', ()=> apply(order[idx]));
})();
