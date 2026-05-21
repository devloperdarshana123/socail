import { motion } from "framer-motion";
import img1 from "../assets/1.svg";
import img2 from "../assets/2.svg";
import img3 from "../assets/3.svg";
import img4 from "../assets/4.svg";
import img5 from "../assets/5.svg";

// We define the final properties for Framer Motion to animate to
const collageItems = [
  { src: img1, className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-10", rotate: -12, x: -100, y: -60 },
  { src: img2, className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-20", rotate: 8, x: 100, y: -80 },
  { src: img5, className: "w-44 md:w-52 lg:w-60 aspect-[3/4] z-30", rotate: -6, x: -120, y: 80 },
  { src: img4, className: "w-40 md:w-48 lg:w-56 aspect-[3/4] z-40", rotate: 12, x: 110, y: 90 },
  { src: img3, className: "w-52 md:w-64 lg:w-72 aspect-[3/4] z-50 shadow-2xl", rotate: 0, x: 0, y: 0 }
];

export default function AnimatedCollage() {
  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center p-8 overflow-visible">
      {collageItems.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.2, y: 150, rotate: item.rotate > 0 ? 30 : -30, x: 0 }}
          animate={{ opacity: 1, scale: 1, y: item.y, x: item.x, rotate: item.rotate }}
          transition={{ 
            delay: i * 0.35, 
            type: "spring", 
            stiffness: 100, 
            damping: 14 
          }}
          className={`absolute rounded-3xl overflow-hidden shadow-xl border-[6px] border-white bg-gray-50 ${item.className}`}
        >
          <img src={item.src} alt="" className="w-full h-full object-cover" />
        </motion.div>
      ))}
    </div>
  );
}
