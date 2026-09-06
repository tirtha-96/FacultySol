import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app';
import { repository } from './repository';
beforeEach(()=>repository.reset());
describe('assessment API',()=>{
  it('creates an assessment with validation',async()=>{const r=await request(app).post('/api/assessments').send({courseId:'cse203',title:'Midterm',year:2026,totalMarks:50,duration:90});expect(r.status).toBe(201);expect(r.body.data.title).toBe('Midterm')});
  it('retrieves calculated analysis',async()=>{const r=await request(app).get('/api/assessments/assessment-2026/analysis');expect(r.status).toBe(200);expect(r.body.data.components.cloAlignment).toBeTypeOf('number')});
  it('retrieves prioritized recommendations',async()=>{const r=await request(app).get('/api/assessments/assessment-2026/recommendations');expect(r.status).toBe(200);expect(r.body.data[0]).toHaveProperty('evidence')});
  it('returns a safe missing-resource error',async()=>{const r=await request(app).get('/api/assessments/nope');expect(r.status).toBe(404);expect(r.body.error.code).toBe('NOT_FOUND')});
});
