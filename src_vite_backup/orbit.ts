import { DATA } from './data';
import { UTILS } from './utils';
import { Person, Goal } from './types';

interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

interface Connection {
  from: OrbitNode;
  to: OrbitNode;
  type: 'goal_link' | 'person_link' | 'relationship_link';
  strength?: number;
}

class OrbitNode {
  id: string;
  type: 'user' | 'goal' | 'person';
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  data: Person | Goal | any;
  pulse: number;
  angle: number;
  orbitSpeed: number;
  pulseSpeed: number;
  floatOffset: number;
  drawAtPos?: { x: number; y: number };

  constructor(id: string, type: 'user' | 'goal' | 'person', name: string, x: number, y: number, data: any) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.data = data;
    this.pulse = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.orbitSpeed = 0.001 + Math.random() * 0.002;
    this.pulseSpeed = 0.03;
    this.floatOffset = Math.random() * 100;
  }

  update(allNodes: OrbitNode[]) {
    if (this.type === 'goal') {
      // Goals float subtly
      this.pulse += this.pulseSpeed;
      const offset = Math.sin(this.pulse + this.floatOffset) * 8;
      const angle = Math.atan2(this.y, this.x);
      this.x = this.targetX + Math.cos(angle) * offset;
      this.y = this.targetY + Math.sin(angle) * offset;
    } else if (this.type === 'person') {
      // Persons orbit their parent goals
      const parentGoal = allNodes.find(n => n.type === 'goal' && n.id === this.data.goalId);
      if (parentGoal) {
        this.angle += this.orbitSpeed;
        // Distance from goal matches relevance (higher relevance = closer in)
        const relevanceFactor = (100 - this.data.relevance) * 1.5;
        const dist = 65 + relevanceFactor; // Range from 65px to ~110px
        
        this.targetX = parentGoal.x + Math.cos(this.angle) * dist;
        this.targetY = parentGoal.y + Math.sin(this.angle) * dist;
        
        // Smooth interpolation
        this.x = UTILS.lerp(this.x, this.targetX, 0.1);
        this.y = UTILS.lerp(this.y, this.targetY, 0.1);
      }
    } else if (this.type === 'user') {
      // User node pulses gently
      this.pulse += 0.02;
    }
  }

  draw(ctx: CanvasRenderingContext2D, isHovered: boolean, isSelected: boolean) {
    ctx.save();
    if (this.type === 'user') {
      this.drawUserNode(ctx);
    } else if (this.type === 'goal') {
      this.drawGoalNode(ctx, isHovered, isSelected);
    } else if (this.type === 'person') {
      this.drawPersonNode(ctx, isHovered, isSelected);
    }
    ctx.restore();
  }

  private drawUserNode(ctx: CanvasRenderingContext2D) {
    const radius = 30;
    const pulseSize = radius + Math.sin(this.pulse) * 4;
    
    // Outer white glow (shades of grayscale)
    const grad = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, pulseSize + 15);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulseSize + 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Outer secondary ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Main core
    ctx.fillStyle = '#09090b'; // void background
    ctx.strokeStyle = '#ffffff'; // white accent
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Initials text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Geist Sans", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DATA.user.avatar, this.x, this.y);
  }

  private drawGoalNode(ctx: CanvasRenderingContext2D, isHovered: boolean, isSelected: boolean) {
    const radius = 24;

    // Outer faint orbits
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, 70, 0, Math.PI * 2);
    ctx.arc(this.x, this.y, 95, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Selection outline ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer progress ring (shades of gray completion)
    const circumference = Math.PI * 2;
    const progressAngle = circumference * (this.data.progress / 100);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius + 4, 0, circumference);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff'; // solid white progress indicator
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius + 4, -Math.PI / 2, -Math.PI / 2 + progressAngle);
    ctx.stroke();

    // Main core
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = isHovered ? '#ffffff' : '#3f3f46'; // zinc 700
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label below node
    ctx.fillStyle = isHovered || isSelected ? '#ffffff' : '#a1a1aa';
    ctx.font = '500 11px "Geist Sans", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.name, this.x, this.y + radius + 12);
  }

  private drawPersonNode(ctx: CanvasRenderingContext2D, isHovered: boolean, isSelected: boolean) {
    const radius = 16;
    const statusColor = UTILS.getStatusColor(this.data.status);
    const statusGlow = UTILS.getStatusGlow(this.data.status);
    
    // Pulse animation rings for active relationship threads
    if (this.data.status === 'active' || this.data.status === 'scheduled') {
      this.pulse += 0.04;
      const pulseRad = radius + Math.sin(this.pulse) * 3;
      ctx.strokeStyle = statusGlow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, pulseRad + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer soft halo
    ctx.fillStyle = statusGlow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core node
    ctx.fillStyle = '#09090b';
    
    // Render custom border styles depending on stage (less friction identification)
    ctx.strokeStyle = isHovered ? '#ffffff' : statusColor;
    ctx.lineWidth = 2;
    
    if (this.data.status === 'undiscovered') {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Double rings border for scheduled meetings (milestones)
    if (this.data.status === 'scheduled') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius - 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Initials text
    ctx.fillStyle = isHovered ? '#ffffff' : '#e4e4e7';
    ctx.font = '600 10px "Geist Sans", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.data.avatar, this.x, this.y);
  }
}

export const OrbitEngine = (() => {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  
  const transform: ViewportTransform = {
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1
  };
  
  let isDragging = false;
  const dragStart = { x: 0, y: 0 };
  let hoverNode: OrbitNode | null = null;
  let selectedNode: OrbitNode | null = null;
  
  const GOAL_ORBIT_RADIUS = 320;
  
  let nodes: OrbitNode[] = [];
  let connections: Connection[] = [];

  const initData = () => {
    nodes = [];
    connections = [];
    
    // Center User Node
    const userNode = new OrbitNode("user_center", "user", DATA.user.name, 0, 0, DATA.user);
    nodes.push(userNode);
    
    // Distribute Goals Radially
    const goalCount = DATA.goals.length;
    DATA.goals.forEach((goal, i) => {
      const angle = (i * 2 * Math.PI) / goalCount;
      const x = Math.cos(angle) * GOAL_ORBIT_RADIUS;
      const y = Math.sin(angle) * GOAL_ORBIT_RADIUS;
      
      const goalNode = new OrbitNode(goal.id, "goal", goal.name, x, y, goal);
      nodes.push(goalNode);
      
      connections.push({
        from: userNode,
        to: goalNode,
        type: 'goal_link'
      });
    });
    
    // Distribute Person Nodes Orbiting Goals
    DATA.people.forEach((person) => {
      const goalNode = nodes.find(n => n.id === person.goalId);
      if (goalNode) {
        // Position them in orbit around their target goal
        const px = goalNode.x + (Math.random() - 0.5) * 120;
        const py = goalNode.y + (Math.random() - 0.5) * 120;
        
        const personNode = new OrbitNode(person.id, "person", person.name, px, py, person);
        nodes.push(personNode);
        
        connections.push({
          from: goalNode,
          to: personNode,
          type: 'person_link'
        });

        // Strengthened threads (Active or Scheduled) draw visual links to user center
        if (person.status === 'active' || person.status === 'scheduled') {
          connections.push({
            from: userNode,
            to: personNode,
            type: 'relationship_link',
            strength: person.relevance / 100
          });
        }
      }
    });
  };

  const handleCanvasClick = (e: MouseEvent) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldPos = screenToWorld(mouseX, mouseY);
    let clickedNode: OrbitNode | null = null;
    
    // Search reversed to hit foreground elements first
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      let radius = 16; // person
      if (node.type === 'user') radius = 30;
      if (node.type === 'goal') radius = 24;
      
      if (UTILS.pointInCircle(worldPos.x, worldPos.y, node.x, node.y, radius + 10)) {
        clickedNode = node;
        break;
      }
    }
    
    if (clickedNode) {
      if (clickedNode.type === 'user') {
        resetCamera();
      } else {
        selectedNode = clickedNode;
        zoomToNode(clickedNode, 1.2);
        document.dispatchEvent(new CustomEvent('nodeSelected', { detail: clickedNode }));
      }
    } else {
      selectedNode = null;
      document.dispatchEvent(new CustomEvent('canvasCleared'));
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (isDragging || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);
    
    let currentHover: OrbitNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      let radius = 16;
      if (node.type === 'user') radius = 30;
      if (node.type === 'goal') radius = 24;
      
      if (UTILS.pointInCircle(worldPos.x, worldPos.y, node.x, node.y, radius + 6)) {
        currentHover = node;
        break;
      }
    }
    
    if (currentHover !== hoverNode) {
      hoverNode = currentHover;
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
      
      const tooltip = document.getElementById('node-tooltip');
      if (tooltip) {
        if (hoverNode && hoverNode.type !== 'user') {
          tooltip.style.left = `${e.clientX + 15}px`;
          tooltip.style.top = `${e.clientY + 15}px`;
          
          let html = '';
          if (hoverNode.type === 'goal') {
            html = `
              <div class="node-tooltip__name">${hoverNode.name}</div>
              <div class="node-tooltip__role">Goal Progress</div>
              <div class="node-tooltip__relevance">Completed: <span>${hoverNode.data.progress}%</span></div>
            `;
          } else {
            html = `
              <div class="node-tooltip__name">${hoverNode.name}</div>
              <div class="node-tooltip__role">${hoverNode.data.role} @ ${hoverNode.data.company}</div>
              <div class="node-tooltip__relevance">Relevance: <span>${hoverNode.data.relevance}%</span></div>
            `;
          }
          tooltip.innerHTML = html;
          tooltip.classList.add('visible');
        } else {
          tooltip.classList.remove('visible');
        }
      }
    } else if (hoverNode) {
      const tooltip = document.getElementById('node-tooltip');
      if (tooltip) {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
      }
    }
  };

  const zoomToNode = (node: OrbitNode, level = 1.2) => {
    transform.targetX = width / 2 - node.x * level;
    transform.targetY = height / 2 - node.y * level;
    transform.targetZoom = level;
  };

  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - transform.x) / transform.zoom,
      y: (sy - transform.y) / transform.zoom
    };
  };

  const worldToScreen = (wx: number, wy: number) => {
    return {
      x: wx * transform.zoom + transform.x,
      y: wy * transform.zoom + transform.y
    };
  };

  const drawConnections = () => {
    if (!ctx) return;
    connections.forEach((conn) => {
      ctx!.save();
      const from = worldToScreen(conn.from.x, conn.from.y);
      const to = worldToScreen(conn.to.x, conn.to.y);
      
      if (conn.type === 'goal_link') {
        ctx!.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(from.x, from.y);
        ctx!.lineTo(to.x, to.y);
        ctx!.stroke();
      } else if (conn.type === 'person_link') {
        ctx!.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(from.x, from.y);
        ctx!.lineTo(to.x, to.y);
        ctx!.stroke();
      } else if (conn.type === 'relationship_link') {
        // Monochrome relationship thread strength
        const strength = conn.strength || 0.5;
        ctx!.strokeStyle = `rgba(255, 255, 255, ${strength * 0.15})`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(from.x, from.y);
        ctx!.lineTo(to.x, to.y);
        ctx!.stroke();
      }
      ctx!.restore();
    });
  };

  const drawMinimap = () => {
    const mmCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
    if (!mmCanvas) return;
    const mmCtx = mmCanvas.getContext('2d');
    if (!mmCtx) return;
    const mmW = mmCanvas.width;
    const mmH = mmCanvas.height;
    
    mmCtx.clearRect(0, 0, mmW, mmH);
    
    const scale = 0.15;
    const offset = { x: mmW / 2, y: mmH / 2 };
    
    nodes.forEach(node => {
      const mx = node.x * scale + offset.x;
      const my = node.y * scale + offset.y;
      
      if (node.type === 'user') {
        mmCtx.fillStyle = '#ffffff';
        mmCtx.beginPath();
        mmCtx.arc(mx, my, 4, 0, Math.PI * 2);
        mmCtx.fill();
      } else if (node.type === 'goal') {
        mmCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        mmCtx.beginPath();
        mmCtx.arc(mx, my, 3, 0, Math.PI * 2);
        mmCtx.fill();
      } else {
        mmCtx.fillStyle = UTILS.getStatusColor(node.data.status);
        mmCtx.beginPath();
        mmCtx.arc(mx, my, 1.5, 0, Math.PI * 2);
        mmCtx.fill();
      }
    });

    // Viewport box mapping in minimap
    const topleft = screenToWorld(0, 0);
    const bottomright = screenToWorld(width, height);
    
    const rx = topleft.x * scale + offset.x;
    const ry = topleft.y * scale + offset.y;
    const rw = (bottomright.x - topleft.x) * scale;
    const rh = (bottomright.y - topleft.y) * scale;
    
    mmCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(rx, ry, rw, rh);
  };

  const render = () => {
    if (!ctx || !canvas) return;
    
    // Clear screen
    ctx.clearRect(0, 0, width, height);
    
    // Camera damping lerp
    transform.x = UTILS.lerp(transform.x, transform.targetX, 0.1);
    transform.y = UTILS.lerp(transform.y, transform.targetY, 0.1);
    transform.zoom = UTILS.lerp(transform.zoom, transform.targetZoom, 0.1);
    
    const zoomText = document.getElementById('zoom-percentage');
    if (zoomText) {
      zoomText.innerText = `${Math.round(transform.zoom * 100)}%`;
    }

    // Outer grid rings
    const center = worldToScreen(0, 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, GOAL_ORBIT_RADIUS * transform.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw lines
    drawConnections();

    // Draw nodes
    nodes.forEach((node) => {
      node.update(nodes);
      
      ctx!.save();
      const screenPos = worldToScreen(node.x, node.y);
      node.drawAtPos = screenPos;
      
      const backupX = node.x;
      const backupY = node.y;
      node.x = screenPos.x;
      node.y = screenPos.y;
      
      const isNodeHovered = hoverNode !== null && hoverNode.id === node.id;
      const isNodeSelected = selectedNode !== null && selectedNode.id === node.id;
      
      node.draw(ctx!, isNodeHovered, isNodeSelected);
      
      node.x = backupX;
      node.y = backupY;
      ctx!.restore();
    });

    drawMinimap();
    requestAnimationFrame(render);
  };

  const resize = () => {
    if (!canvas || !ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    width = rect.width;
    height = rect.height;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(dpr, dpr);
  };

  const init = (canvasEl: HTMLCanvasElement) => {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    resize();
    initData();
    
    // Recenter
    transform.x = width / 2;
    transform.y = height / 2;
    transform.targetX = width / 2;
    transform.targetY = height / 2;
    transform.zoom = 1.0;
    transform.targetZoom = 1.0;
    
    // Bind listeners
    window.addEventListener('resize', resize);
    
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart.x = e.clientX - transform.x;
      dragStart.y = e.clientY - transform.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        transform.targetX = e.clientX - dragStart.x;
        transform.targetY = e.clientY - dragStart.y;
      } else {
        handleCanvasMouseMove(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('click', handleCanvasClick);
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      let newZoom = transform.targetZoom;
      
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }
      
      transform.targetZoom = Math.max(0.4, Math.min(newZoom, 2.5));
      
      const rect = canvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);
      
      transform.targetX = mouseX - worldPos.x * transform.targetZoom;
      transform.targetY = mouseY - worldPos.y * transform.targetZoom;
    }, { passive: false });

    // Bootstrap data state updating events
    document.addEventListener('dataStateUpdated', () => {
      initData();
    });

    render();
  };

  const selectNodeById = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      selectedNode = node;
      zoomToNode(node, 1.2);
      document.dispatchEvent(new CustomEvent('nodeSelected', { detail: node }));
    }
  };

  const resetCamera = () => {
    transform.targetX = width / 2;
    transform.targetY = height / 2;
    transform.targetZoom = 1.0;
    selectedNode = null;
  };

  return {
    init,
    resize,
    zoomToNode,
    selectNodeById,
    setTargetZoom: (z: number) => transform.targetZoom = z,
    resetCamera
  };
})();
