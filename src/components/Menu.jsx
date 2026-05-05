import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

function Menu() {
  const { user, logout } = useAuth();

  const menuItems = [
    {
      name: "กลุ่มของฉัน",
      path: "/dashboard",
      icon: "G",
      tone: "",
      desc: "ดูสมาชิกและจัดการกลุ่มทั้งหมด",
    },
    {
      name: "ปฏิทินวันว่าง",
      path: "/calendar",
      icon: "C",
      tone: "alt",
      desc: "เลือกกลุ่มเพื่อหาวันที่ว่างตรงกัน",
    },
    {
      name: "Timeline",
      path: "/timeline",
      icon: "T",
      tone: "warn",
      desc: "จัดตารางกิจกรรม วัน เวลา และสถานที่",
    },
    {
      name: "ค่าใช้จ่าย",
      path: "/bills",
      icon: "฿",
      tone: "alt",
      desc: "บันทึกบิลและสรุปยอดที่ต้องจ่ายคืน",
    },
    {
      name: "สร้าง / เข้าร่วม",
      path: "/creategroup",
      icon: "+",
      tone: "warn",
      desc: "สร้างกลุ่มใหม่หรือกรอกรหัสเชิญ",
    },
    {
      name: "โปรไฟล์",
      path: "/profile",
      icon: "P",
      tone: "",
      desc: "ตรวจสอบข้อมูลบัญชี LINE",
    },
  ];

  return (
    <>
      <section className="page-header">
        <div>
          <h1 className="page-title">สวัสดี {user?.name}</h1>
          <p className="page-subtitle">
            เลือกงานที่ต้องการทำต่อได้ทันที ทุกอย่างถูกจัดไว้ตามลำดับการใช้งานหลัก
          </p>
        </div>
        <button className="btn btn-outline-danger px-4" onClick={logout}>
          ออกจากระบบ
        </button>
      </section>

      <section className="menu-grid">
        {menuItems.map((item) => (
          <Link to={item.path} className="menu-card" key={item.path}>
            <span className={`tile-icon ${item.tone}`}>{item.icon}</span>
            <span>
              <h2>{item.name}</h2>
              <p>{item.desc}</p>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}

export default Menu;
