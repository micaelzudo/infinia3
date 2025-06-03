import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface MobileControlsProps {
  onMove: (direction: THREE.Vector2) => void;
  onRotate?: (delta: { x: number; y: number }) => void;
  onJump: () => void;
  onRun: (isRunning: boolean) => void;
  onExit: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMove,
  onJump,
  onRun,
  onExit,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const [isJumpPressed, setIsJumpPressed] = useState(false);
  const [isRunPressed, setIsRunPressed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const activeTouchId = useRef<number | null>(null);
  const rotationTouchId = useRef<number | null>(null);
  const lastRotationPosition = useRef({ x: 0, y: 0 });
  const joystickCenter = useRef({ x: 0, y: 0 });
  const joystickRadius = 60;
  const knobRadius = 30;

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(isMobileDevice);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Initialize joystick
  useEffect(() => {
    if (!isMobile) return;

    const joystick = joystickRef.current;
    const knob = joystickKnobRef.current;
    if (!joystick || !knob) return;

    const updateJoystickPosition = (clientX: number, clientY: number) => {
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      joystickCenter.current = { x: centerX, y: centerY };
      
      // Calculate distance from center
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), joystickRadius);
      
      // Calculate angle
      const angle = Math.atan2(dy, dx);
      
      // Calculate new knob position (limited to joystick radius)
      const knobX = Math.cos(angle) * distance;
      const knobY = Math.sin(angle) * distance;
      
      // Update knob position
      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Calculate normalized direction vector
      const directionX = dx / Math.max(1, Math.abs(dx));
      const directionY = dy / Math.max(1, Math.abs(dy));
      
      // Send movement direction to parent
      onMove(new THREE.Vector2(
        Math.cos(angle) * (distance / joystickRadius),
        Math.sin(angle) * (distance / joystickRadius)
      ));
    };

    const resetJoystick = () => {
      if (knob) {
        knob.style.transform = 'translate(0, 0)';
      }
      onMove(new THREE.Vector2(0, 0));
      activeTouchId.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // If we don't have an active touch and this is the first touch, use it for movement
      if (activeTouchId.current === null && e.touches.length === 1) {
        const touch = e.touches[0];
        activeTouchId.current = touch.identifier;
        updateJoystickPosition(touch.clientX, touch.clientY);
        e.preventDefault();
      } 
      // If we already have a movement touch and this is a second touch, use it for rotation
      else if (activeTouchId.current !== null && rotationTouchId.current === null && e.touches.length === 2) {
        const touch = Array.from(e.touches).find(t => t.identifier !== activeTouchId.current);
        if (touch) {
          rotationTouchId.current = touch.identifier;
          lastRotationPosition.current = { x: touch.clientX, y: touch.clientY };
          e.preventDefault();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Handle movement touch
      if (activeTouchId.current !== null) {
        const moveTouch = Array.from(e.touches).find(t => t.identifier === activeTouchId.current);
        if (moveTouch) {
          updateJoystickPosition(moveTouch.clientX, moveTouch.clientY);
        }
      }

      // Handle rotation touch
      if (rotationTouchId.current !== null) {
        const rotateTouch = Array.from(e.touches).find(t => t.identifier === rotationTouchId.current);
        if (rotateTouch && onRotate) {
          const deltaX = (rotateTouch.clientX - lastRotationPosition.current.x) * 0.5;
          const deltaY = (rotateTouch.clientY - lastRotationPosition.current.y) * 0.5;
          
          onRotate({ x: deltaX, y: deltaY });
          
          // Update last position for next move
          lastRotationPosition.current = {
            x: rotateTouch.clientX,
            y: rotateTouch.clientY
          };
        }
      }

      if (activeTouchId.current !== null || rotationTouchId.current !== null) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      let shouldResetJoystick = false;
      
      // Check which touch ended
      Array.from(e.changedTouches).forEach(touch => {
        if (touch.identifier === activeTouchId.current) {
          activeTouchId.current = null;
          shouldResetJoystick = true;
          
          // If we still have another touch, make it the movement touch
          const remainingTouch = Array.from(e.touches).find(t => t.identifier !== touch.identifier);
          if (remainingTouch) {
            activeTouchId.current = remainingTouch.identifier;
            updateJoystickPosition(remainingTouch.clientX, remainingTouch.clientY);
          }
        } else if (touch.identifier === rotationTouchId.current) {
          rotationTouchId.current = null;
          // Reset rotation position
          lastRotationPosition.current = { x: 0, y: 0 };
          if (onRotate) onRotate({ x: 0, y: 0 });
        }
      });
      
      if (shouldResetJoystick) {
        resetJoystick();
      }
    };

    // Add event listeners
    joystick.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      joystick.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isMobile, onMove]);

  // Handle button press/release for better touch feedback
  const handleJumpPress = () => {
    setIsJumpPressed(true);
    onJump();
  };

  const handleJumpRelease = () => {
    setIsJumpPressed(false);
  };

  const handleRunPress = () => {
    setIsRunPressed(true);
    onRun(true);
  };

  const handleRunRelease = () => {
    setIsRunPressed(false);
    onRun(false);
  };

  if (!isMobile) return null;

  const buttonStyle: React.CSSProperties = {
    position: 'absolute',
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '2px solid rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '14px',
    userSelect: 'none',
    touchAction: 'none',
    opacity: 0.8,
    transition: 'transform 0.1s, opacity 0.1s',
  };

  const joystickStyle: React.CSSProperties = {
    position: 'absolute',
    left: '30px',
    bottom: '30px',
    width: `${joystickRadius * 2}px`,
    height: `${joystickRadius * 2}px`,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    zIndex: 1000,
  };

  const joystickKnobStyle: React.CSSProperties = {
    width: `${knobRadius * 2}px`,
    height: `${knobRadius * 2}px`,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transition: 'transform 0.05s',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1000,
      touchAction: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>
      {/* Visual feedback for rotation mode */}
      {rotationTouchId.current !== null && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          pointerEvents: 'none',
          zIndex: 999,
        }} />
      )}

      {/* Joystick */}
      <div 
        ref={joystickRef} 
        style={{
          ...joystickStyle,
          opacity: rotationTouchId.current !== null ? 0.5 : 1,
        }}
      >
        <div ref={joystickKnobRef} style={joystickKnobStyle} />
      </div>

      {/* Buttons */}
      <div style={{
        position: 'absolute',
        right: '30px',
        bottom: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        opacity: rotationTouchId.current !== null ? 0.5 : 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={{
              ...buttonStyle,
              transform: isJumpPressed ? 'scale(0.9)' : 'scale(1)',
              marginRight: '15px',
            }}
            onTouchStart={handleJumpPress}
            onTouchEnd={handleJumpRelease}
            onTouchCancel={handleJumpRelease}
          >
            JUMP
          </button>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            style={{
              ...buttonStyle,
              transform: isRunPressed ? 'scale(0.9)' : 'scale(1)',
            }}
            onTouchStart={handleRunPress}
            onTouchEnd={handleRunRelease}
            onTouchCancel={handleRunRelease}
          >
            RUN
          </button>
          <button
            style={buttonStyle}
            onTouchStart={onExit}
          >
            EXIT
          </button>
        </div>
      </div>

      {/* Instructions */}
      {!rotationTouchId.current && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '10px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          pointerEvents: 'none',
          textAlign: 'center',
          zIndex: 1001,
        }}>
          Use two fingers to look around
        </div>
      )}
    </div>
  );
};

export default MobileControls;
