from rest_framework import viewsets
from .models import Student
from .serializers import StudentSerializer

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer

    def get_queryset(self):
        qs = Student.objects.all()
        grade = self.request.query_params.get('grade')
        if grade:
            qs = qs.filter(grade=grade)
        return qs
