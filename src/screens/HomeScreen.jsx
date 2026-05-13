import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import './HomeScreen.css';

export function HomeScreen() {
  return (
    <Layout>
      <Header title="⚖️ Themis" />
      <div className="home-container">
        <section className="hero">
          <h1>디지털 증거 관리 플랫폼</h1>
          <p>투명한 기록과 안전한 리포팅을 위한 통합 솔루션입니다.</p>
        </section>

        <section className="content-section">
          <div className="card">
            <h2>시스템 상태</h2>
            <ul>
              <li>✓ 서버: 정상</li>
              <li>✓ 데이터베이스: 연결됨</li>
              <li>✓ 업타임: 99.9%</li>
            </ul>
          </div>

          <div className="card">
            <h2>기능</h2>
            <ul>
              <li>📝 증거 기록</li>
              <li>🔒 안전한 저장</li>
              <li>📊 분석 및 리포팅</li>
            </ul>
          </div>
        </section>

        <section className="action-section">
          <button className="btn btn-primary">시작하기</button>
          <button className="btn btn-secondary">더 알아보기</button>
        </section>
      </div>
    </Layout>
  );
}
