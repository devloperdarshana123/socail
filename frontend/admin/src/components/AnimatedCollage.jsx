import { motion } from "framer-motion";
const collageItems = [
  { src: "https://res.cloudinary.com/dl1zz15t1/image/upload/v1782477854/1_ejyneb.svg", className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-10", rotate: -12, x: -100, y: -60 },
  { src: "https://res.cloudinary.com/dl1zz15t1/image/upload/v1782477808/2_hr3zul.svg", className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-20", rotate: 8, x: 100, y: -80 },
  { src: "https://res.cloudinary.com/dl1zz15t1/image/upload/v1782477804/5_lm1hsq.svg", className: "w-44 md:w-52 lg:w-60 aspect-[3/4] z-30", rotate: -6, x: -120, y: 80 },
  { src: "https://res.cloudinary.com/dl1zz15t1/image/upload/v1782477801/4_h8cgvp.svg", className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-40", rotate: 12, x: 110, y: 90 },
  { src: "https://res.cloudinary.com/dl1zz15t1/image/upload/v1782477798/3_qbjpu8.svg", className: "w-52 md:w-64 lg:w-72 aspect-[3/4] z-50 shadow-2xl", rotate: 0, x: 0, y: 0 }
];



export default function AnimatedCollage() {
  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center p-8 overflow-visible">
      {collageItems.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8, y: 30, rotate: item.rotate > 0 ? 30 : -30, x: item.x }}
          animate={{ opacity: 1, scale: 1, y: item.y, x: item.x, rotate: item.rotate }}
          transition={{ 
  delay: i * 0.12, 
  type: "spring", 
  stiffness: 120, 
  damping: 16 
}}
          className={`absolute rounded-3xl overflow-hidden shadow-xl border-[6px] border-white bg-gray-50 ${item.className}`}
        >
          <img src={item.src} alt="" className="w-full h-full object-cover" />
        </motion.div>
      ))}
    </div>
  );
}
