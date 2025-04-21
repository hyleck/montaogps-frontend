import html2canvas from 'html2canvas';

export async function applyThemeTransition(callback: () => void) {
  const canvas = await html2canvas(document.body, { scale: 1 }); // 👈 calidad reducida
  const dataUrl = canvas.toDataURL();

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '-5px'; // para que desaparezca hacia arriba
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '9999';
  overlay.style.backgroundImage = `url(${dataUrl})`;
  overlay.style.backgroundSize = 'cover';
  overlay.style.backgroundPosition = 'center center';
  overlay.style.backgroundAttachment = 'fixed';
  // overlay.style.transition = 'all 1s'; // ⏱ más rápido y fluido
  overlay.style.pointerEvents = 'none';
  overlay.style.boxShadow = '0 0px 20px rgb(0, 0, 0)';


  

  // 👇 Forma circular y que encoja desde el centro

  document.body.appendChild(overlay);

  // Asegurarse que se pinta antes de cambiar el tema
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      callback(); // aplicar el cambio de tema

      setTimeout(()=>{
        overlay.style.height = '0';
     
      },2000)
    });
  });

  setTimeout(() => {
    overlay.remove();
  }, 7000); // acorde a la duración de la transición
}
