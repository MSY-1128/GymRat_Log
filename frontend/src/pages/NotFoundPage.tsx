import { Link } from 'react-router';
import ui from '../styles/ui.module.css';

export function NotFoundPage() {
  return (
    <section className={ui.card}>
      <h1 className={ui.title}>페이지를 찾을 수 없어요</h1>
      <p className={ui.subtitle}>
        <Link to="/">오늘 화면으로 돌아가기</Link>
      </p>
    </section>
  );
}
